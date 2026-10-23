(function(){var out={sourceHost:location.hostname,tables:[]};var capture=function cellSnapshot(doc,cell){
    const LF=String.fromCharCode(10);
    const skip=/^(SCRIPT|STYLE|INPUT|TEXTAREA|SELECT|BUTTON|FORM|IMG|SVG|CANVAS)$/;
    const blockTags=/^(DIV|P|LI|DT|DD|SECTION|ARTICLE|HEADER|FOOTER|TR|TD|TH|TABLE|FORM|H1|H2|H3|H4|H5|H6)$/;
    const view=doc.defaultView||doc.parentWindow;
    let out='';
    const brk=()=>{if(out.slice(-1)!==LF)out+=LF;};
    const walk=node=>{
      if(node.nodeType===3){out+=node.nodeValue;return;}
      if(node.nodeType!==1)return;
      const tag=node.tagName||'';
      if(skip.test(tag))return;
      if(tag==='BR'){out+=LF;return;}
      if(tag==='HR'){out+=LF+'---'+LF;return;}
      const title=(node.getAttribute&&node.getAttribute('title'))||'';
      let mark='';
      if(/教师|老师/.test(title))mark='【教师】';
      else if(/教室|地点/.test(title))mark='【地点】';
      else if(/周次|周数/.test(title))mark='【周次】';
      if(mark){brk();out+=mark;}
      let block=blockTags.test(tag);
      if(!block){try{block=/^(BLOCK|FLEX|GRID|LIST-ITEM|FLOW-ROOT|TABLE|TABLE-ROW|TABLE-CELL|TABLE-CAPTION)$/.test(String(view.getComputedStyle(node).display).toUpperCase());}catch(e){}}
      if(block)brk();
      for(let child=node.firstChild;child;child=child.nextSibling)walk(child);
      if(block)brk();
    };
    for(let child=cell.firstChild;child;child=child.nextSibling)walk(child);
    const text=out.split(LF).map(s=>s.replace(/[\t\u00a0\u3000 ]+/g,' ').trim()).filter((s,i,arr)=>s!==''||(i>0&&arr[i-1]!=='')).join(LF).trim();
    return {text,rowSpan:cell.rowSpan,colSpan:cell.colSpan};
  };function scan(doc){Array.from(doc.querySelectorAll("table")).forEach(function(table){if(table.rows.length>80)return;out.tables.push({rows:Array.from(table.rows).map(function(row){return {cells:Array.from(row.cells).map(function(cell){return capture(doc,cell);})};})});});Array.from(doc.querySelectorAll("iframe,frame")).forEach(function(f){try{if(f.contentDocument)scan(f.contentDocument);}catch(e){}});}scan(document);return JSON.stringify(out);})()