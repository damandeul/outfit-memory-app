export async function saveBackupFile(data:unknown,filename:string) {
 const json=JSON.stringify(data);
 if(new Blob([json]).size>200*1024*1024)throw new Error('백업 파일이 200MB를 초과해.');
 const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
