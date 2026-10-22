(function(){var out={sourceHost:location.hostname,tables:[]};var capture=function cellSnapshot(doc,cell){
    const LF=String.fromCharCode(10);
    const clone=cell.cloneNode(true);
    clone.querySelectorAll('input,textarea,select,button,script,style,form').forEach(n=>n.remove());
    clone.querySelectorAll('br').forEach(n=>n.replaceWith(doc.createTextNode(LF)));
    clone.querySelectorAll('hr').forEach(n=>n.replaceWith(doc.createTextNode(LF+'---'+LF)));
    clone.querySelectorAll('div,p,li,dt,dd,section,article,header,footer').forEach(n=>{if((n.textContent||'').slice(-1)!==LF)n.appendChild(doc.createTextNode(LF));});
    clone.querySelectorAll('[title]').forEach(n=>{const t=n.getAttribute('title')||'';const tag=/教师|老师/.test(t)?'【教师】':/教室|地点/.test(t)?'【地点】':/周次|周数/.test(t)?'【周次】':'';if(!tag)return;const prev=n.previousSibling;if(!prev||!(prev.textContent||'').endsWith(LF))n.prepend(doc.createTextNode(LF));n.prepend(doc.createTextNode(tag));});
    return {text:(clone.textContent||'').trim(),rowSpan:cell.rowSpan,colSpan:cell.colSpan};
  };function scan(doc){Array.from(doc.querySelectorAll("table")).forEach(function(table){if(table.rows.length>80)return;out.tables.push({rows:Array.from(table.rows).map(function(row){return {cells:Array.from(row.cells).map(function(cell){return capture(doc,cell);})};})});});Array.from(doc.querySelectorAll("iframe,frame")).forEach(function(f){try{if(f.contentDocument)scan(f.contentDocument);}catch(e){}});}scan(document);return JSON.stringify(out);})()