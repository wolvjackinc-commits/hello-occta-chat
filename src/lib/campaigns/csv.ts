export type CampaignImportRow = {
 email:string;full_name?:string;company?:string;tags?:string[];consent_at?:string
};
export const CAMPAIGN_CSV_HEADERS=["email","full_name","company","tags","consent_at"];
export function parseCampaignCsv(text:string):CampaignImportRow[]{
 const data=text.replace(/^\uFEFF/,"");
 const rows:string[][]=[];let row:string[]=[],cell="",quoted=false;
 for(let i=0;i<data.length;i++){
  const ch=data[i];
  if(ch==='"'){
   if(quoted&&data[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;
  }else if(ch===","&&!quoted){row.push(cell);cell="";}
  else if((ch==="\n"||ch==="\r")&&!quoted){
   if(ch==="\r"&&data[i+1]==="\n")i++;
   row.push(cell);cell="";if(row.some(v=>v.trim()))rows.push(row);row=[];
  }else cell+=ch;
 }
 if(quoted)throw new Error("The CSV has an unclosed quoted field.");
 row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
 if(rows.length<2)throw new Error("The CSV has no contact rows.");
 const headers=rows[0].map(h=>h.trim().toLowerCase().replace(/\s+/g,"_"));
 if(!headers.includes("email"))throw new Error("The CSV must contain an email column.");
 if(rows.length>5001)throw new Error("Maximum 5,000 contact rows per file.");
 return rows.slice(1).map(row=>{
  const val=(name:string)=>row[headers.indexOf(name)]?.trim()||"";
  return {email:val("email").toLowerCase(),full_name:val("full_name"),company:val("company"),
   tags:val("tags").split(/[;|]/).map(t=>t.trim()).filter(Boolean),consent_at:val("consent_at")};
 });
}
export function safeCsvCell(value:unknown){
 const content=String(value??"");
 // Spreadsheet formula injection protection even for quoted fields.
 const safe=/^[=+\-@\t\r]/.test(content)?"'"+content:content;
 return '"'+safe.replace(/"/g,'""')+'"';
}
export function toCampaignCsv(headers:string[],rows:unknown[][]){
 return "\uFEFF"+[headers,...rows].map(row=>row.map(safeCsvCell).join(",")).join("\r\n");
}
