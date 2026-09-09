'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './operations-console.module.css';

type Row = Record<string, any>;
type Tab = 'platform'|'processing'|'fees'|'expert'|'access';

async function api(path:string, method='GET', body?:unknown) {
  const res = await fetch(`/api/control-plane${path}`, {
    method,
    headers: body === undefined ? undefined : {'Content-Type':'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(payload?.error?.message || `HTTP ${res.status}`);
  return payload?.data ?? payload;
}

const value=(o:Row,k:string)=>String(o?.[k]??'');
const option=(r:Row,label:string)=>`${label} · ${String(r.id||'').slice(0,8)}`;

export function OperationsConsole(){
  const [tab,setTab]=useState<Tab>('platform');
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState<{ok:boolean;text:string}|null>(null);
  const [data,setData]=useState<{merchants:Row[];stores:Row[];accounts:Row[];connections:Row[];vaults:Row[];fees:Row[];tiers:Row[];orders:Row[];users:Row[]}>({merchants:[],stores:[],accounts:[],connections:[],vaults:[],fees:[],tiers:[],orders:[],users:[]});

  const refresh=async()=>{
    try{
      const [m,s,a,c,v,f,t,o,u]=await Promise.all([
        api('/merchants?limit=200'),api('/stores?limit=300'),api('/processing/provider-accounts'),api('/processing/provider-connections'),api('/processing/vaults'),api('/fees'),api('/tiers'),api('/expert/orders?limit=300'),api('/users')
      ]);
      setData({
        merchants:m.merchants||[],stores:s.stores||[],accounts:a.providerAccounts||[],connections:c.providerConnections||[],vaults:v.gatewayVaults||[],fees:f.feeConfigs||[],tiers:t.tiers||[],orders:o.orders||[],users:u.users||[]
      });
    }catch(e:any){setNotice({ok:false,text:e.message||'Falha ao atualizar dados.'});}
  };
  useEffect(()=>{void refresh()},[]);

  const run=async(label:string,path:string,method:string,body?:unknown)=>{
    setBusy(true);setNotice(null);
    try{const result=await api(path,method,body);setNotice({ok:true,text:`${label}: concluído.`});await refresh();return result;}
    catch(e:any){setNotice({ok:false,text:`${label}: ${e.message}`});return null}
    finally{setBusy(false)}
  };

  return <div className={styles.wrap}>
    <div className={styles.hero}><div><h1>Live Operations</h1><p>Criação, edição, desativação e routing da plataforma. Alterações passam pelo Control Plane, RBAC e Audit Log. Transactions e WalletMovements continuam imutáveis.</p></div><span className={styles.live}>WRITE ENABLED</span></div>
    <div className={styles.summary}>
      <Metric n={data.merchants.length} label="Merchants"/><Metric n={data.stores.length} label="Stores"/><Metric n={data.connections.length} label="Connections"/><Metric n={data.vaults.length} label="Gateway Vaults"/>
    </div>
    <div className={styles.tabs}>
      {([['platform','Platform'],['processing','Processing & Routing'],['fees','Fees & Tiers'],['expert','XPay Expert'],['access','Actors & Access']] as [Tab,string][]).map(([k,l])=><button key={k} onClick={()=>setTab(k)} className={`${styles.tab} ${tab===k?styles.tabActive:''}`}>{l}</button>)}
    </div>
    {notice?<div className={`${styles.notice} ${notice.ok?styles.ok:styles.bad}`}>{notice.text}</div>:null}
    {tab==='platform'?<Platform data={data} busy={busy} run={run}/>:null}
    {tab==='processing'?<Processing data={data} busy={busy} run={run}/>:null}
    {tab==='fees'?<Fees data={data} busy={busy} run={run}/>:null}
    {tab==='expert'?<Expert data={data} busy={busy} run={run}/>:null}
    {tab==='access'?<Access data={data} busy={busy} run={run}/>:null}
  </div>
}

function Metric({n,label}:{n:number;label:string}){return <div className={styles.metric}><strong>{n}</strong><span>{label}</span></div>}

type Props={data:any;busy:boolean;run:(label:string,path:string,method:string,body?:unknown)=>Promise<any>};

function Platform({data,busy,run}:Props){
  const [m,setM]=useState({email:'',name:'',company:'',tier:'TIER_C_STANDARD',password:''});
  const [merchantId,setMerchantId]=useState(''); const selectedMerchant=data.merchants.find((x:Row)=>x.id===merchantId)||{};
  const [merchantStatus,setMerchantStatus]=useState('active'); const [merchantTier,setMerchantTier]=useState('TIER_C_STANDARD');
  const [store,setStore]=useState({merchantId:'',storeCode:'',name:'',currency:'EUR',domain:'',status:'draft'});
  const [storeId,setStoreId]=useState(''); const [storeStatus,setStoreStatus]=useState('active');
  return <div className={styles.grid}>
    <Card title="Criar Merchant" note="Cria identidade Merchant. Password vazia gera credencial não retornada; para login imediato indique password de 12+ caracteres.">
      <div className={styles.form}><Row><Input label="Email" value={m.email} onChange={v=>setM({...m,email:v})}/><Input label="Nome" value={m.name} onChange={v=>setM({...m,name:v})}/></Row><Row><Input label="Empresa" value={m.company} onChange={v=>setM({...m,company:v})}/><Select label="Tier" value={m.tier} onChange={v=>setM({...m,tier:v})} options={data.tiers.map((x:Row)=>[x.code,x.name])}/></Row><Input label="Password opcional" type="password" value={m.password} onChange={v=>setM({...m,password:v})}/><button disabled={busy} className={styles.primary} onClick={()=>run('Criar Merchant','/merchants','POST',{...m,password:m.password||undefined})}>Criar Merchant</button></div>
    </Card>
    <Card title="Editar / apagar Merchant" note="Se existir histórico financeiro, Delete suspende em vez de destruir dados.">
      <div className={styles.form}><Select label="Merchant" value={merchantId} onChange={v=>{setMerchantId(v);const x=data.merchants.find((r:Row)=>r.id===v);if(x){setMerchantStatus(String(x.status));setMerchantTier(String(x.tier))}}} options={data.merchants.map((x:Row)=>[x.id,`${x.name} · ${x.email}`])}/><Row><Select label="Status" value={merchantStatus} onChange={setMerchantStatus} options={['active','pending','suspended','inactive'].map(x=>[x,x])}/><Select label="Tier" value={merchantTier} onChange={setMerchantTier} options={data.tiers.map((x:Row)=>[x.code,x.name])}/></Row><div className={styles.actions}><button disabled={busy||!merchantId} className={styles.primary} onClick={()=>run('Atualizar Merchant',`/merchants/${merchantId}`,'PATCH',{status:merchantStatus,tier:merchantTier})}>Guardar</button><button disabled={busy||!merchantId} className={styles.danger} onClick={()=>confirm(`Apagar/suspender ${selectedMerchant.name||'Merchant'}?`)&&run('Apagar Merchant',`/merchants/${merchantId}`,'DELETE')}>Apagar / suspender</button></div></div>
    </Card>
    <Card title="Criar Store" note="A Store nasce sem Gateway até ser configurada no separador Processing & Routing.">
      <div className={styles.form}><Select label="Merchant" value={store.merchantId} onChange={v=>setStore({...store,merchantId:v})} options={data.merchants.map((x:Row)=>[x.id,`${x.name} · ${x.email}`])}/><Row><Input label="Store code" value={store.storeCode} onChange={v=>setStore({...store,storeCode:v})}/><Input label="Nome" value={store.name} onChange={v=>setStore({...store,name:v})}/></Row><Row><Input label="Moeda" value={store.currency} onChange={v=>setStore({...store,currency:v.toUpperCase()})}/><Select label="Status" value={store.status} onChange={v=>setStore({...store,status:v})} options={['draft','active','inactive'].map(x=>[x,x])}/></Row><Input label="Domínio" value={store.domain} onChange={v=>setStore({...store,domain:v})}/><button disabled={busy} className={styles.primary} onClick={()=>run('Criar Store','/stores','POST',store)}>Criar Store</button></div>
    </Card>
    <Card title="Store lifecycle" note="Desativação segura quando existem Transactions, Payouts, Vaults ou Connections.">
      <div className={styles.form}><Select label="Store" value={storeId} onChange={v=>{setStoreId(v);const s=data.stores.find((x:Row)=>x.id===v);if(s)setStoreStatus(String(s.status))}} options={data.stores.map((x:Row)=>[x.id,`${x.store_code} · ${x.name} · ${x.merchant_name}`])}/><Select label="Status" value={storeStatus} onChange={setStoreStatus} options={['active','draft','inactive'].map(x=>[x,x])}/><div className={styles.actions}><button disabled={busy||!storeId} className={styles.primary} onClick={()=>run('Atualizar Store',`/stores/${storeId}`,'PATCH',{status:storeStatus})}>Guardar</button><button disabled={busy||!storeId} className={styles.danger} onClick={()=>confirm('Apagar/desativar Store?')&&run('Apagar Store',`/stores/${storeId}`,'DELETE')}>Apagar / desativar</button></div></div>
    </Card>
  </div>
}

function Processing({data,busy,run}:Props){
  const [pa,setPa]=useState({provider:'stripe',externalAccountId:'',environment:'test',country:'',defaultCurrency:'EUR',status:'active'});
  const [vault,setVault]=useState({merchantId:'',storeId:'',provider:'stripe',credentials:'{"environment":"test"}',isActive:true});
  const [conn,setConn]=useState({merchantId:'',storeId:'',providerAccountId:'',gatewayVaultId:'',alias:'',mode:'DIRECT',credentialMode:'VAULT',capturePolicy:'automatic',status:'active',shadowMode:false,ledgerEnabled:true});
  const [profile,setProfile]=useState({storeId:'',providerConnectionId:'',runtimeGeneration:'V1',processingMode:'ORCHESTRATED',activationState:'ACTIVE'});
  const [deleteIds,setDeleteIds]=useState({account:'',vault:'',connection:''});
  const merchantStores=useMemo(()=>data.stores.filter((s:Row)=>!vault.merchantId||s.merchant_id===vault.merchantId),[data.stores,vault.merchantId]);
  const connStores=useMemo(()=>data.stores.filter((s:Row)=>!conn.merchantId||s.merchant_id===conn.merchantId),[data.stores,conn.merchantId]);
  const connVaults=useMemo(()=>data.vaults.filter((v:Row)=>!conn.merchantId||v.merchant_id===conn.merchantId),[data.vaults,conn.merchantId]);
  return <div className={styles.grid}>
    <Card title="Provider Account" note="Conta física/externa do provider. Não contém o secret do Gateway Vault."><div className={styles.form}><Row><Input label="Provider" value={pa.provider} onChange={v=>setPa({...pa,provider:v})}/><Input label="External Account ID" value={pa.externalAccountId} onChange={v=>setPa({...pa,externalAccountId:v})}/></Row><Row><Select label="Environment" value={pa.environment} onChange={v=>setPa({...pa,environment:v})} options={['test','live'].map(x=>[x,x])}/><Input label="Currency" value={pa.defaultCurrency} onChange={v=>setPa({...pa,defaultCurrency:v.toUpperCase()})}/></Row><button disabled={busy} className={styles.primary} onClick={()=>run('Criar Provider Account','/processing/provider-accounts','POST',pa)}>Criar Provider Account</button><Select label="Apagar Provider Account" value={deleteIds.account} onChange={v=>setDeleteIds({...deleteIds,account:v})} options={data.accounts.map((x:Row)=>[x.id,`${x.provider} · ${x.external_account_id}`])}/><button disabled={busy||!deleteIds.account} className={styles.danger} onClick={()=>confirm('Apagar Provider Account?')&&run('Apagar Provider Account',`/processing/provider-accounts/${deleteIds.account}`,'DELETE')}>Apagar</button></div></Card>
    <Card title="Gateway Vault" note="Credentials são write-only: o frontend nunca consegue recuperar os valores existentes."><div className={styles.form}><Select label="Merchant" value={vault.merchantId} onChange={v=>setVault({...vault,merchantId:v,storeId:''})} options={data.merchants.map((x:Row)=>[x.id,`${x.name} · ${x.email}`])}/><Select label="Store (opcional)" value={vault.storeId} onChange={v=>setVault({...vault,storeId:v})} options={merchantStores.map((x:Row)=>[x.id,`${x.store_code} · ${x.name}`])}/><Input label="Provider" value={vault.provider} onChange={v=>setVault({...vault,provider:v})}/><Textarea label="Credentials JSON" value={vault.credentials} onChange={v=>setVault({...vault,credentials:v})}/><button disabled={busy} className={styles.primary} onClick={()=>{let credentials;try{credentials=JSON.parse(vault.credentials)}catch{return alert('JSON inválido')};void run('Criar Gateway Vault','/processing/vaults','POST',{...vault,storeId:vault.storeId||null,credentials})}}>Criar Vault</button><Select label="Apagar / desativar Vault" value={deleteIds.vault} onChange={v=>setDeleteIds({...deleteIds,vault:v})} options={data.vaults.map((x:Row)=>[x.id,`${x.provider} · ${x.store_name||'Merchant-level'}`])}/><button disabled={busy||!deleteIds.vault} className={styles.danger} onClick={()=>confirm('Apagar/desativar Vault?')&&run('Apagar Vault',`/processing/vaults/${deleteIds.vault}`,'DELETE')}>Apagar / desativar</button></div></Card>
    <Card title="Provider Connection" note="Liga Store + ProviderAccount + GatewayVault. Ownership e provider family são validados no backend."><div className={styles.form}><Select label="Merchant" value={conn.merchantId} onChange={v=>setConn({...conn,merchantId:v,storeId:'',gatewayVaultId:''})} options={data.merchants.map((x:Row)=>[x.id,`${x.name} · ${x.email}`])}/><Select label="Store" value={conn.storeId} onChange={v=>setConn({...conn,storeId:v})} options={connStores.map((x:Row)=>[x.id,`${x.store_code} · ${x.name}`])}/><Select label="Provider Account" value={conn.providerAccountId} onChange={v=>setConn({...conn,providerAccountId:v})} options={data.accounts.map((x:Row)=>[x.id,`${x.provider} · ${x.external_account_id} · ${x.environment}`])}/><Select label="Gateway Vault" value={conn.gatewayVaultId} onChange={v=>setConn({...conn,gatewayVaultId:v})} options={connVaults.map((x:Row)=>[x.id,`${x.provider} · ${x.store_name||'Merchant-level'}`])}/><Row><Input label="Alias" value={conn.alias} onChange={v=>setConn({...conn,alias:v})}/><Input label="Mode" value={conn.mode} onChange={v=>setConn({...conn,mode:v})}/></Row><button disabled={busy} className={styles.primary} onClick={()=>run('Criar Connection','/processing/provider-connections','POST',{...conn,gatewayVaultId:conn.gatewayVaultId||null})}>Criar Connection</button><Select label="Apagar / desativar Connection" value={deleteIds.connection} onChange={v=>setDeleteIds({...deleteIds,connection:v})} options={data.connections.map((x:Row)=>[x.id,`${x.alias} · ${x.store_code||x.store_name||''} · ${x.provider}`])}/><button disabled={busy||!deleteIds.connection} className={styles.danger} onClick={()=>confirm('Apagar/desativar Connection?')&&run('Apagar Connection',`/processing/provider-connections/${deleteIds.connection}`,'DELETE')}>Apagar / desativar</button></div></Card>
    <Card title="Store Processing Profile" note="Este é o selector efetivo do fluxo: define qual ProviderConnection a Store utiliza em runtime."><div className={styles.form}><Select label="Store" value={profile.storeId} onChange={v=>setProfile({...profile,storeId:v,providerConnectionId:''})} options={data.stores.map((x:Row)=>[x.id,`${x.store_code} · ${x.name} · ${x.merchant_name}`])}/><Select label="Provider Connection" value={profile.providerConnectionId} onChange={v=>setProfile({...profile,providerConnectionId:v})} options={data.connections.filter((x:Row)=>!profile.storeId||x.store_id===profile.storeId).map((x:Row)=>[x.id,`${x.alias} · ${x.provider} · ${x.status}`])}/><Row><Input label="Processing mode" value={profile.processingMode} onChange={v=>setProfile({...profile,processingMode:v})}/><Input label="Activation state" value={profile.activationState} onChange={v=>setProfile({...profile,activationState:v})}/></Row><button disabled={busy||!profile.storeId} className={styles.primary} onClick={()=>run('Guardar Processing Profile',`/stores/${profile.storeId}/processing-profile`,'PUT',{...profile,providerConnectionId:profile.providerConnectionId||null})}>Ativar fluxo da Store</button><div className={styles.meta}>Store → ProcessingProfile → ProviderConnection → ProviderAccount + GatewayVault</div></div></Card>
  </div>
}

function Fees({data,busy,run}:Props){
 const [tier,setTier]=useState({code:'',name:'',description:'',rank:'100',feePercentBps:'0',feeFixedMinor:'0'});const [fee,setFee]=useState({storeId:'',feePercentBps:'0',feeFixedMinor:'0',feeBasis:'SETTLEMENT_GROSS'});const [deleteTier,setDeleteTier]=useState('');const store=data.stores.find((x:Row)=>x.id===fee.storeId)||{};
 return <div className={styles.grid}><Card title="Criar Tier" note="Defaults comerciais/financeiros para classificação de Merchants."><div className={styles.form}><Row><Input label="Code" value={tier.code} onChange={v=>setTier({...tier,code:v.toUpperCase()})}/><Input label="Nome" value={tier.name} onChange={v=>setTier({...tier,name:v})}/></Row><Input label="Descrição" value={tier.description} onChange={v=>setTier({...tier,description:v})}/><Row><Input label="Fee % (bps)" type="number" value={tier.feePercentBps} onChange={v=>setTier({...tier,feePercentBps:v})}/><Input label="Fee fixa minor" type="number" value={tier.feeFixedMinor} onChange={v=>setTier({...tier,feeFixedMinor:v})}/></Row><button disabled={busy} className={styles.primary} onClick={()=>run('Criar Tier','/tiers','POST',{...tier,rank:Number(tier.rank),feePercentBps:Number(tier.feePercentBps),feeFixedMinor:Number(tier.feeFixedMinor)})}>Criar Tier</button><Select label="Apagar / desativar Tier" value={deleteTier} onChange={setDeleteTier} options={data.tiers.map((x:Row)=>[x.id,`${x.code} · ${x.name}`])}/><button disabled={busy||!deleteTier} className={styles.danger} onClick={()=>confirm('Apagar/desativar Tier?')&&run('Apagar Tier',`/tiers/${deleteTier}`,'DELETE')}>Apagar / desativar</button></div></Card><Card title="Fee por Store" note="Cria configuração versionada; Delete desativa e encerra vigência, não apaga histórico."><div className={styles.form}><Select label="Store" value={fee.storeId} onChange={v=>setFee({...fee,storeId:v})} options={data.stores.map((x:Row)=>[x.id,`${x.store_code} · ${x.name} · ${x.merchant_name}`])}/><Row><Input label="Fee % (bps)" type="number" value={fee.feePercentBps} onChange={v=>setFee({...fee,feePercentBps:v})}/><Input label="Fee fixa minor" type="number" value={fee.feeFixedMinor} onChange={v=>setFee({...fee,feeFixedMinor:v})}/></Row><button disabled={busy||!fee.storeId} className={styles.primary} onClick={()=>run('Criar Fee','/fees','POST',{merchantId:store.merchant_id,storeId:fee.storeId,feeBasis:fee.feeBasis,feePercentBps:Number(fee.feePercentBps),feeFixedMinor:Number(fee.feeFixedMinor),active:true})}>Criar Fee</button><div className={styles.meta}>{data.fees.length} configurações existentes.</div></div></Card></div>
}

function Expert({data,busy,run}:Props){
 const [orderId,setOrderId]=useState('');const [detail,setDetail]=useState<any>(null);const [assigned,setAssigned]=useState('');const [step,setStep]=useState({code:'',status:'IN_PROGRESS',notes:''});const [proof,setProof]=useState('');const [asset,setAsset]=useState({kind:'DOMAIN',label:'',valueText:''});
 const load=async(id:string)=>{setOrderId(id);if(!id){setDetail(null);return}try{setDetail(await api(`/expert/orders/${id}`));}catch(e:any){alert(e.message)}};
 return <div className={styles.grid}><Card title="Contratação XPay.Expert" note="Gestão central das mesmas ServiceOrders usadas em xpay.expert/ops."><div className={styles.form}><Select label="Order" value={orderId} onChange={v=>void load(v)} options={data.orders.map((x:Row)=>[x.id,`${x.order_code} · ${x.offering_name} · ${x.merchant_name}`])}/><Input label="Assigned to" value={assigned} onChange={setAssigned}/><button disabled={busy||!orderId} className={styles.primary} onClick={()=>run('Atribuir contratação',`/expert/orders/${orderId}`,'PATCH',{assignedTo:assigned})}>Guardar responsável</button><Input label="Proof reference" value={proof} onChange={setProof}/><button disabled={busy||!orderId} className={styles.secondary} onClick={()=>confirm('Confirmar pagamento manual? Não cria Transaction/WalletMovement.')&&run('Confirmar pagamento',`/expert/orders/${orderId}/confirm-payment`,'POST',{proofReference:proof,note:'Confirmed from XPAYMENTS Control Plane'})}>Confirmar pagamento manual</button></div></Card><Card title="Workflow" note="Atualiza uma das 14 etapas e recalcula status/progresso."><div className={styles.form}><Select label="Step" value={step.code} onChange={v=>setStep({...step,code:v})} options={(detail?.steps||[]).map((x:Row)=>[x.code,`${x.position}. ${x.label} · ${x.status}`])}/><Select label="Status" value={step.status} onChange={v=>setStep({...step,status:v})} options={['PENDING','IN_PROGRESS','COMPLETED','BLOCKED','SKIPPED'].map(x=>[x,x])}/><Input label="Notas" value={step.notes} onChange={v=>setStep({...step,notes:v})}/><button disabled={busy||!orderId||!step.code} className={styles.primary} onClick={async()=>{await run('Atualizar etapa',`/expert/orders/${orderId}/steps/${step.code}`,'PATCH',{status:step.status,notes:step.notes});await load(orderId)}}>Atualizar etapa</button></div></Card><Card title="Entregáveis / Assets" note="Domain, Company Number, Bank Account, Website, VPS, XPAYMENTS Store e outros."><div className={styles.form}><Select label="Kind" value={asset.kind} onChange={v=>setAsset({...asset,kind:v})} options={['LEGAL_ENTITY','COMPANY_NUMBER','BANK_ACCOUNT','ACQUIRER','DOMAIN','EMAIL','PHONE','VPS','WEBSITE','XPAYMENTS_STORE','GATEWAY_VAULT','PROVIDER_CONNECTION','DOCUMENT','OTHER'].map(x=>[x,x])}/><Input label="Label" value={asset.label} onChange={v=>setAsset({...asset,label:v})}/><Input label="Valor" value={asset.valueText} onChange={v=>setAsset({...asset,valueText:v})}/><button disabled={busy||!orderId||!asset.valueText} className={styles.primary} onClick={async()=>{await run('Criar asset',`/expert/orders/${orderId}/assets`,'POST',asset);await load(orderId)}}>Adicionar asset</button><div className={styles.meta}>{detail?.assets?.length||0} assets · {detail?.requirements?.length||0} requisitos · {detail?.tickets?.length||0} tickets</div></div></Card><Card title="Estado da contratação" note="Resumo read-only carregado da ServiceOrder."><pre className={styles.notice}>{detail?JSON.stringify({orderCode:detail.order?.order_code,status:detail.order?.status,progress:detail.order?.progress,paymentStatus:detail.order?.payment_status,currentSteps:(detail.steps||[]).filter((x:Row)=>x.status==='IN_PROGRESS').map((x:Row)=>x.code)},null,2):'Selecione uma Order.'}</pre></Card></div>
}

function Access({data,busy,run}:Props){const [u,setU]=useState({email:'',name:'',password:'',role:'READ_ONLY'});const [disable,setDisable]=useState('');return <div className={styles.grid}><Card title="Criar utilizador interno" note="Password nunca é devolvida; sessões são próprias do Control Plane."><div className={styles.form}><Row><Input label="Email" value={u.email} onChange={v=>setU({...u,email:v})}/><Input label="Nome" value={u.name} onChange={v=>setU({...u,name:v})}/></Row><Row><Input label="Password" type="password" value={u.password} onChange={v=>setU({...u,password:v})}/><Select label="Role" value={u.role} onChange={v=>setU({...u,role:v})} options={['SUPER_ADMIN','OPERATIONS','FINANCE','RISK','SUPPORT','EXPERT_OPS','READ_ONLY'].map(x=>[x,x])}/></Row><button disabled={busy} className={styles.primary} onClick={()=>run('Criar utilizador','/users','POST',u)}>Criar utilizador</button></div></Card><Card title="Desativar acesso" note="Revoga sessões ativas e preserva Audit Log."><div className={styles.form}><Select label="Utilizador" value={disable} onChange={setDisable} options={data.users.map((x:Row)=>[x.id,`${x.name} · ${x.email} · ${x.role}`])}/><button disabled={busy||!disable} className={styles.danger} onClick={()=>confirm('Desativar utilizador e revogar sessões?')&&run('Desativar utilizador',`/users/${disable}`,'DELETE')}>Desativar acesso</button></div></Card></div>}

function Card({title,note,children}:{title:string;note:string;children:any}){return <section className={styles.card}><h2>{title}</h2><p>{note}</p>{children}</section>}
function Row({children}:{children:any}){return <div className={styles.row}>{children}</div>}
function Input({label,value,onChange,type='text'}:{label:string;value:string;onChange:(v:string)=>void;type?:string}){return <div className={styles.field}><label>{label}</label><input type={type} value={value} onChange={e=>onChange(e.target.value)}/></div>}
function Textarea({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){return <div className={styles.field}><label>{label}</label><textarea value={value} onChange={e=>onChange(e.target.value)}/></div>}
function Select({label,value,onChange,options}:{label:string;value:string;onChange:(v:string)=>void;options:[any,any][]}){return <div className={styles.field}><label>{label}</label><select value={value} onChange={e=>onChange(e.target.value)}><option value="">— selecionar —</option>{options.map(([v,l])=><option key={String(v)} value={String(v)}>{String(l)}</option>)}</select></div>}
