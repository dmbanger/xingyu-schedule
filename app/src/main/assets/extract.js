(function(){var out={sourceHost:location.hostname,tables:[]};var capture=function cellSnapshot(doc,cell){
    const LF=String.fromCharCode(10);
    const skipTag=/^(SCRIPT|STYLE|INPUT|TEXTAREA|SELECT|BUTTON|FORM|IMG|SVG|CANVAS|NOSCRIPT)$/;
    const range=doc.createRange?doc.createRange():null;
    let out='';
    let lastTop=null;
    const newline=function(){if(out.slice(-1)!==LF)out+=LF;};
    function visit(node){
      if(node.nodeType===3){
        const text=node.nodeValue||'';
        if(!text.trim())return;
        let top=null;
        if(range){try{range.selectNodeContents(node);const rects=range.getClientRects();if(rects&&rects.length)top=rects[0].top;}catch(e){}}
        if(top!==null){
          if(lastTop!==null&&top-lastTop>3)newline();
          lastTop=top;
        }
        out+=text;
        return;
      }
      if(node.nodeType!==1)return;
      const tag=node.tagName||'';
      if(skipTag.test(tag))return;
      if(tag==='BR'){newline();lastTop=null;return;}
      if(tag==='HR'){newline();out+='---';newline();lastTop=null;return;}
      const title=(node.getAttribute&&node.getAttribute('title'))||'';
      let mark='';
      if(/教师|老师/.test(title))mark='【教师】';
      else if(/教室|地点/.test(title))mark='【地点】';
      else if(/周次|周数/.test(title))mark='【周次】';
      if(mark){newline();out+=mark;lastTop=null;}
      const block=/^(DIV|P|LI|DT|DD|SECTION|ARTICLE|HEADER|FOOTER|TR|TD|TH|TABLE|H1|H2|H3|H4|H5|H6)$/.test(tag);
      if(block)newline();
      for(let child=node.firstChild;child;child=child.nextSibling)visit(child);
      if(block)newline();
      if(mark){newline();lastTop=null;}
    }
    for(let child=cell.firstChild;child;child=child.nextSibling)visit(child);
    const text=out.split(LF).map(function(s){return s.replace(/[\t\u00a0\u3000 ]+/g,' ').trim();}).filter(function(s,i,arr){return s!==''||(i>0&&arr[i-1]!=='');}).join(LF).trim();
    return {text:text,rowSpan:cell.rowSpan,colSpan:cell.colSpan};
  };function scan(doc){Array.from(doc.querySelectorAll("table")).forEach(function(table){if(table.rows.length>80)return;out.tables.push({rows:Array.from(table.rows).map(function(row){return {cells:Array.from(row.cells).map(function(cell){return capture(doc,cell);})};})});});Array.from(doc.querySelectorAll("iframe,frame")).forEach(function(f){try{if(f.contentDocument)scan(f.contentDocument);}catch(e){}});}scan(document);return JSON.stringify(out);})()