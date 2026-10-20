/* NEXO SEI - importação conservadora e local de PDFs de escalas.
   Usa PDF.js hospedado no próprio repositório (sem envio de PDFs). */
'use strict';
const NEXO_MESES={janeiro:1,fevereiro:2,marco:3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12};
const NEXO_POSTO='(?:SUBTEN\\s+PM|ST\\s+PM|[123][º°o]?\\s*SGT\\s+PM|CB\\s+PM|SD\\s+PM|MAJ\\s+PM|CAP\\s+PM|CEL\\s+PM|TEN\\s+CEL\\s+PM|[12][º°o]?\\s*TEN\\s+PM|ASP\\s+OF\\s+PM)';
const NEXO_LINHA_PM=new RegExp('^\\s*\\d{1,3}\\s+.+?\\s+('+NEXO_POSTO+')\\s+(\\d{5,6})\\s+([A-ZÀ-Ý][A-ZÀ-Ý\\s\\-\\u2019\']{5,}?)\\s+\\(\\d{2}\\)\\s*[\\d\\s\\-()]{8,}\\s+(\\d{7,9})\\s+(?:SIM|NÃO|NAO)\\b','i');
const NEXO_CAB_RE=/^\s*Escala\s*n[ºo°]\.?\s*:\s*([^\r\n]+)/gmi;
function nexoNormalizar(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();}
function nexoCampo(texto,re,obrigatorio=false){const m=texto.match(re);if(!m){if(obrigatorio)throw Error('Campo obrigatório não encontrado: '+(re.source.split('\\')[0]||'escala'));return '';}return m[1].trim();}
function nexoIsoDate(valor){const s=nexoNormalizar(valor).toLowerCase();let m=s.match(/\b(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})\b/);let day,month,year;if(m){day=+m[1];month=NEXO_MESES[m[2]];year=+m[3];}else{m=s.match(/\b(\d{1,2})\s+(\d{1,2})\s+(\d{4})\b/);if(!m)return '';day=+m[1];month=+m[2];year=+m[3];}if(!month)return '';const date=new Date(Date.UTC(year,month-1,day));if(date.getUTCDate()!==day||date.getUTCMonth()+1!==month||date.getUTCFullYear()!==year)return '';return [year,String(month).padStart(2,'0'),String(day).padStart(2,'0')].join('-');}
function nexoLinhasPagina(items){
  const itemsText=(items||[]).filter(it=>it.str && it.str.trim() && it.transform),linhas=[];
  for(const it of itemsText){const x=it.transform[4],y=it.transform[5];let linha=linhas.find(l=>Math.abs(l.y-y)<Math.max(2,Math.abs(it.height||0)*.32));if(!linha){linha={y,items:[]};linhas.push(linha);}linha.items.push({x,w:it.width||0,text:it.str});}
  linhas.sort((a,b)=>b.y-a.y);
  return linhas.map(line=>{line.items.sort((a,b)=>a.x-b.x);let out='',end=-Infinity;for(const part of line.items){if(out&&part.x-end>2)out+=' ';out+=part.text;end=Math.max(end,part.x+part.w);}return out.trim();}).filter(Boolean).join('\n');
}
function nexoSepararEscalas(paginas){
  const grupos=[],avisos=[];let atual=null;
  for(let idx=0;idx<paginas.length;idx++){
    const texto=paginas[idx]||'',pagina=idx+1;
    const starts=[...texto.matchAll(new RegExp(NEXO_CAB_RE.source,'gmi'))];
    if(!starts.length){
      if(/^\s*Evento\s*:/im.test(texto)&&/^\s*Dia\s*:/im.test(texto)){avisos.push(`Página ${pagina}: possível nova escala sem cabeçalho; ignorada.`);atual=null;}
      else if(atual)atual.trechos.push({pagina,texto});
      else if(texto.trim())avisos.push(`Página ${pagina}: escala não identificada; ignorada.`);
      continue;
    }
    const anterior=texto.slice(0,starts[0].index);
    if(atual&&anterior.trim()&&/^\s*(?:\d{1,3}\s+\d|MOBILIZAÇÃO|OBSERVAÇÃO)/im.test(anterior))atual.trechos.push({pagina,texto:anterior});
    starts.forEach((m,i)=>{
      const trecho=texto.slice(m.index,i+1<starts.length?starts[i+1].index:texto.length);
      const numero=m[1].trim(),mensagem=nexoCampo(trecho,/Msg\s*n[ºo°]\.?\s*:\s*([^\r\n]+)/i);
      const antes=atual?atual.trechos.map(t=>t.texto).join('\n'):'';
      const diaAntigo=nexoCampo(antes,/^Dia\s*:\s*(.+)$/im),diaNovo=nexoCampo(trecho,/^Dia\s*:\s*(.+)$/im);
      const iguais=atual&&nexoNormalizar(atual.numero)===nexoNormalizar(numero);
      const msgIgual=mensagem&&atual&&nexoNormalizar(atual.mensagem)===nexoNormalizar(mensagem);
      const continuaSemMensagem=!mensagem&&atual&&atual.mensagem&&!/^\s*(?:Evento|Dia)\s*:/im.test(trecho);
      const diaIgual=!diaAntigo||!diaNovo||nexoNormalizar(diaAntigo)===nexoNormalizar(diaNovo);
      if(iguais&&(msgIgual||continuaSemMensagem)&&diaIgual)atual.trechos.push({pagina,texto:trecho});
      else{atual={numero,mensagem,trechos:[{pagina,texto:trecho}]};grupos.push(atual);}
    });
  }
  return {grupos,avisos};
}
function nexoInterpretarGrupo(grupo){
  const texto=grupo.trechos.map(t=>t.texto).join('\n');
  const numero=nexoCampo(texto,/Escala\s*n[ºo°]\.?\s*:\s*([^\r\n]+)/i,true);
  const mensagem=nexoCampo(texto,/Msg\s*n[ºo°]\.?\s*:\s*([^\r\n]+)/i,true);
  const evento=nexoCampo(texto,/^Evento\s*:\s*(.+)$/im,true);
  const dia=nexoCampo(texto,/^Dia\s*:\s*(.+)$/im,true);
  const horario=nexoCampo(texto,/^Hor[aá]rio do servi[cç]o\s*:\s*(.+)$/im,true);
  const apresentacao=nexoCampo(texto,/^Apresenta[cç][aã]o\s*:\s*(.+)$/im,true);
  const uniforme=nexoCampo(texto,/^Uniforme\s*\/\s*Armamento\s*\/\s*Equipamento\s*:\s*([\s\S]*?)(?=^\s*(?:Alimenta[cç][aã]o|Transporte|Local de emprego|MOBILIZA[CÇ][AÃ]O)\s*:|^\s*MOBILIZA[CÇ][AÃ]O\b|$)/im)||nexoCampo(texto,/^Uniforme\s*\/\s*Armamento\s*\/\s*Equipamento\s*:\s*(.+)$/im,true);
  const data=nexoIsoDate(dia);if(!data)throw Error('Data do serviço inválida ou ausente.');
  const policiais=[],vistos=new Map();
  for(const trecho of grupo.trechos)for(const linha of trecho.texto.split('\n')){
    const m=linha.match(NEXO_LINHA_PM);if(!m)continue;
    const p={graduacao:m[1].trim().replace(/\s+/g,' '),rg:m[2],nome:m[3].trim().replace(/\s+/g,' '),id_funcional:m[4],pagina:trecho.pagina};
    if(vistos.has(p.rg)){const ant=vistos.get(p.rg);if(['nome','graduacao','id_funcional'].some(k=>nexoNormalizar(ant[k])!==nexoNormalizar(p[k])))throw Error('RG '+p.rg+' repetido com dados divergentes.');continue;}
    vistos.set(p.rg,p);policiais.push(p);
  }
  if(!policiais.length)throw Error('Nenhum policial reconhecido na tabela; formato não suportado.');
  if(!uniforme.trim()||!apresentacao.trim())throw Error('Apresentação ou uniforme incompletos.');
  return {numero,mensagem,evento,data,horario,apresentacao,uniforme:uniforme.trim().replace(/\s+/g,' '),policiais,arquivo_origem:'PDF Android'};
}
function nexoExtrairEscalasPaginas(paginas){
  if(!paginas.some(p=>p.trim().length>80))throw Error('PDF sem texto extraível. Digitalizações precisam de OCR.');
  const {grupos,avisos}=nexoSepararEscalas(paginas),erros=[...avisos],escalas=[],seen=new Set(),bloqueadas=new Set();
  if(!grupos.length)throw Error('Não encontrei cabeçalhos "Escala nº" no PDF.');
  for(const grupo of grupos){try{
    const e=nexoInterpretarGrupo(grupo),k=nexoChave(e);
    if(seen.has(k)){erros.push('Escala '+e.numero+': cabeçalho repetido fora de sequência; revisão necessária.');bloqueadas.add(k);for(let i=escalas.length-1;i>=0;i--)if(nexoChave(escalas[i])===k)escalas.splice(i,1);continue;}
    if(!bloqueadas.has(k)){escalas.push(e);seen.add(k);}
  }catch(err){erros.push('Escala '+grupo.numero+': '+err.message);}}
  return {escalas,erros};
}
function nexoChave(e){return [nexoNormalizar(e.numero),nexoNormalizar(e.mensagem),e.data].join('|');}
function nexoEquivalente(a,b){return ['numero','mensagem','evento','data','horario','apresentacao','uniforme'].every(k=>nexoNormalizar(a[k])===nexoNormalizar(b[k]))&&JSON.stringify(a.policiais.map(p=>[p.rg,nexoNormalizar(p.nome),nexoNormalizar(p.graduacao),p.id_funcional]).sort((x,y)=>x[0].localeCompare(y[0])))===JSON.stringify(b.policiais.map(p=>[p.rg,nexoNormalizar(p.nome),nexoNormalizar(p.graduacao),p.id_funcional]).sort((x,y)=>x[0].localeCompare(y[0])));}
function nexoRenderRelatorio(msg,isError=false){const el=document.getElementById('pdfRelatorio');if(!el)return;el.className='pdf-report '+(isError?'error':'');el.textContent=msg;}
async function nexoImportarPDFs(arquivos){
  const input=document.getElementById('inputPdf'),botao=document.getElementById('btnPdfImport');
  botao.setAttribute('aria-disabled','true');
  try{
    const files=Array.from(arquivos||[]);if(!files.length)return;
    if(files.length>20||files.some(f=>f.size>35e6||!/\.pdf$/i.test(f.name)))throw Error('Selecione até 20 PDFs, com no máximo 35 MB cada.');
    if(!globalThis.pdfjsLib)throw Error('Leitor de PDF indisponível. Reabra o NEXO e tente novamente.');
    pdfjsLib.GlobalWorkerOptions.workerSrc='./vendor/pdf.worker.min.js';
    let total=[],warnings=[];
    for(const f of files){
      nexoRenderRelatorio('Lendo '+f.name+' no aparelho...');
      const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await f.arrayBuffer()),isEvalSupported:false}).promise;
      try{
        if(pdf.numPages>250)throw Error('PDF com mais de 250 páginas. Divida o documento.');
        const pages=[];
        for(let p=1;p<=pdf.numPages;p++){
          if(p%8===0)await new Promise(resolve=>setTimeout(resolve,0));
          const page=await pdf.getPage(p),items=await page.getTextContent();pages.push(nexoLinhasPagina(items.items));page.cleanup();
        }
        const res=nexoExtrairEscalasPaginas(pages);total.push(...res.escalas);warnings.push(...res.erros.map(m=>f.name+': '+m));
      }catch(err){warnings.push(f.name+': '+err.message);}finally{await pdf.destroy();}
    }
    const previous=new Map(state.escalas.map(e=>[nexoChave(e),e]));
    const novo=[];let iguais=0,conflitos=0;const seen=new Map();
    for(const e of total){const k=nexoChave(e),ja=previous.get(k)||seen.get(k);if(ja){if(nexoEquivalente(e,ja))iguais++;else{conflitos++;warnings.push('Escala '+e.numero+': já existe com informações diferentes; não importada.');}continue;}novo.push(e);seen.set(k,e);}
    const details=warnings.length?'\n\nPENDÊNCIAS ('+warnings.length+'):\n'+warnings.slice(0,15).join('\n')+(warnings.length>15?'\n...':''):'';
    const summary=`Escalas identificadas: ${total.length}\nNovas: ${novo.length}\nJá cadastradas: ${iguais}\nConflitos: ${conflitos}${details}`;
    nexoRenderRelatorio(summary,Boolean(warnings.length));
    if(!novo.length){toast('Nenhuma escala nova para cadastrar.',Boolean(warnings.length));return;}
    if(state.escalas.length+novo.length>5000)throw Error('Limite de 5.000 escalas atingido.');
    if(!confirm(summary+'\n\nAdicionar somente as '+novo.length+' escalas novas ao cadastro do aparelho? Os policiais existentes não serão alterados.'))return;
    const atualizado={...state,escalas:[...state.escalas,...novo]};
    await writeDB(atualizado);state=atualizado;refresh();nexoRenderRelatorio(summary+'\n\nIMPORTAÇÃO CONCLUÍDA.');toast(novo.length+' escala(s) adicionada(s).');
  }catch(err){nexoRenderRelatorio('Falha: '+err.message,true);toast('Não foi possível importar o PDF.',true);}finally{botao.removeAttribute('aria-disabled');if(input)input.value='';}
}
const nexoInputPdf=document.getElementById('inputPdf');
if(nexoInputPdf)nexoInputPdf.addEventListener('change',e=>nexoImportarPDFs(e.target.files));

