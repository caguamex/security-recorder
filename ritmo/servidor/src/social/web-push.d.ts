declare module 'web-push' {
 const webpush:{generateRequestDetails:(subscription:any,payload:string,options:any)=>{endpoint:string;headers:Record<string,string>;body:Buffer};generateVAPIDKeys:()=>{publicKey:string;privateKey:string}};
 export default webpush;
}
