// Civilian route copies use original leg boundaries. A missing stop always breaks the line.
function retainedRouteSections(route, removed) {
  const hidden = new Set(removed);
  const sections = [];
  let section;
  route.waypoints.forEach((point, index) => {
    if (hidden.has(index)) {
      section = undefined;
      return;
    }
    if (!section) {
      section = { waypoints: [], segments: [], indices: [] };
      sections.push(section);
    } else {
      section.segments.push(route.segments[index - 1]);
    }
    section.waypoints.push(point);
    section.indices.push(index);
  });
  return sections;
}

function cleanupStopName(route, index) {
  return route.waypoints[index].name || ('Stop ' + (index + 1));
}

function cleanupItems(route, sections) {
  const tm = stamp();
  const batch = crypto.randomUUID();
  return sections.map((section, i) => {
    const folder = 'copy-' + batch + '-' + (i + 1);
    const uid = euid(folder);
    const name = route.name + ' (edited)' + (sections.length > 1 ? ' · ' + (i + 1) : '');
    let xml;
    if (section.waypoints.length === 1) {
      const point = section.waypoints[0];
      const label = name + ' · ' + cleanupStopName(route, section.indices[0]);
      xml = '<event version="2.0" type="b-m-p-s-m" how="h-e" uid="' + esc(uid) + '" time="' + tm.t + '" start="' + tm.t + '" stale="' + tm.s + '">'
        + '<point lat="' + Number(point.lat) + '" lon="' + Number(point.lon) + '" hae="9999999" ce="9999999" le="9999999"/>'
        + '<detail><contact callsign="' + esc(label) + '"/><archive/></detail></event>';
    } else {
      xml = routeCot({ ...section, uid: folder, name, color: route.color }, tm, true);
    }
    return { folder, uid, xml };
  });
}

function openRouteCleanup(route) {
  const dialog = document.getElementById('routeCleanup');
  const picker = dialog.querySelector('select');
  const drawing = dialog.querySelector('.cleanup-preview');
  const remove = dialog.querySelector('.cleanup-remove');
  const undo = dialog.querySelector('.cleanup-undo');
  const save = dialog.querySelector('.cleanup-export');
  const svgSave = dialog.querySelector('.cleanup-svg');
  const status = dialog.querySelector('[role=status]');
  const title = dialog.querySelector('h2');
  const hidden = Array.isArray(route.cleanupRemoved) ? route.cleanupRemoved : [];
  const removed = [...new Set(hidden.filter(i => Number.isInteger(i) && i >= 0 && i < route.waypoints.length))];
  const legCount = route.waypoints.length - 1;
  // Legacy projects can contain a single joined track without per-stop leg boundaries.
  // Only original, identifiable legs can be removed without inventing new geometry.
  if (route.segments.length !== legCount || route.segments.some((leg, i) => {
    const a = route.waypoints[i], b = route.waypoints[i + 1];
    return !Array.isArray(leg) || leg.length < 2 || leg.some(p => !Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1]))
      || leg[0][0] !== a.lat || leg[0][1] !== a.lon || leg.at(-1)[0] !== b.lat || leg.at(-1)[1] !== b.lon;
  })) {
    toast('This saved track has no matching per-stop legs. Import the original ATAK route to edit a copy.');
    return;
  }
  title.textContent = route.name + ' · edited copy';
  const svgNS = 'http://www.w3.org/2000/svg';
  const make = (tag, attributes) => {
    const el = document.createElementNS(svgNS, tag);
    for (const [k, v] of Object.entries(attributes)) el.setAttribute(k, v);
    return el;
  };
  // Project once into drawing coordinates, relative to the previous longitude at the date line.
  const projected = [];
  let previousX;
  for (const leg of route.segments) {
    projected.push(leg.map(([lat, lon]) => {
      const p = L.CRS.EPSG3857.latLngToPoint([lat, lon], 0);
      if (previousX !== undefined) p.x += 256 * Math.round((previousX - p.x) / 256);
      previousX = p.x;
      return p;
    }));
  }
  const bounds = L.bounds([projected[0][0]]);
  projected.forEach(leg => leg.forEach(p => bounds.extend(p)));
  const size = bounds.getSize(), center = bounds.getCenter();
  const scale = Math.min(600 / (size.x || 1e-12), 300 / (size.y || 1e-12));
  const xy = p => [320 + (p.x-center.x)*scale, 170 + (p.y-center.y)*scale];
  function picture(sections, interactive) {
    const svg = make('svg', { viewBox:'0 0 640 340', width:'640', height:'340', role:'img', 'aria-label':title.textContent });
    svg.append(make('rect',{width:640,height:340,fill:'#f5f7f5'}));
    for (const part of sections) {
      for (const index of part.indices.slice(1)) {
        const points = projected[index-1].map(p => xy(p).join(',')).join(' ');
        svg.append(make('polyline',{points,stroke:'#176766','stroke-width':3,fill:'none'}));
      }
    }
    for (const part of sections) {
      for (const i of part.indices) {
        const [x,y] = xy(i === legCount ? projected.at(-1).at(-1) : projected[i][0]);
        const g = make('g',{});
        const label = make('text',{x,y:y+4,fill:'white','font-size':11,'font-family':'sans-serif','text-anchor':'middle'});
        label.textContent = String(i+1);
        g.append(make('circle',{cx:x,cy:y,r:10,fill:interactive && picker.value === String(i) ? '#ac460d' : '#175253'}),label);
        if (interactive) g.onclick = () => { picker.value = String(i); redraw(); };
        svg.append(g);
      }
    }
    return svg;
  }
  function redraw() {
    drawing.replaceChildren(picture(retainedRouteSections(route, removed), true));
  }
  function render(preferred) {
    const sections = retainedRouteSections(route, removed);
    picker.replaceChildren();
    for (const part of sections) for (const i of part.indices) {
      const label = cleanupStopName(route,i);
      picker.add(new Option(route.waypoints[i].name ? (i+1) + ' · ' + label : label, String(i)));
    }
    if (preferred !== undefined && Array.from(picker.options).some(o => o.value === String(preferred))) picker.value = String(preferred);
    remove.disabled = picker.disabled = save.disabled = svgSave.disabled = !picker.length;
    undo.disabled = !removed.length;
    status.textContent = picker.length + ' stops in edited copy · ' + sections.length + ' separate sections';
    redraw();
  }
  function changed(preferred) {
    route.cleanupRemoved = removed.slice();
    scheduleAutosave();
    render(preferred);
  }
  picker.onchange = redraw;
  remove.onclick = () => {
    if (!picker.length) return;
    const position = picker.selectedIndex;
    removed.push(Number(picker.value));
    changed(picker.options[position+1]?.value ?? picker.options[position-1]?.value);
  };
  undo.onclick = () => { if (removed.length) changed(removed.pop()); };
  dialog.querySelector('.cleanup-close').onclick = () => dialog.close();
  // Close before invoking PED's filename prompt so its controls can receive focus.
  save.onclick = async () => {
    const sections = retainedRouteSections(route, removed);
    if (!sections.length || save.disabled) return;
    save.disabled = true;
    try {
      const blob = await buildPkg(cleanupItems(route, sections), crypto.randomUUID(), route.name + ' (edited)');
      dialog.close();
      await download(blob, safeFileName(route.name + ' edited', '.zip'), {done:'Edited ATAK package exported.'});
    } catch (err) { toast('Could not export the edited package: ' + err.message); }
    finally { save.disabled = false; }
  };
  svgSave.onclick = async () => {
    const svg = picture(retainedRouteSections(route, removed), false);
    const text = new XMLSerializer().serializeToString(svg);
    dialog.close();
    await download(new Blob([text],{type:'image/svg+xml'}),safeFileName(route.name + ' edited','.svg'),{done:'Edited route drawing exported.'});
  };
  render();
  dialog.showModal();
}
