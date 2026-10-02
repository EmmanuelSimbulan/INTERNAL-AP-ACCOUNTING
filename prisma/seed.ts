import { PrismaClient, RoleCode, RequestStatus } from "@prisma/client";
import { hash } from "argon2";
import { permissionCodes, rolePermissions } from "../src/lib/rbac";

const db = new PrismaClient();
const paymentTypes = [
  ["CASH_ADVANCE", "Cash Advance", false],
  ["TAX_LICENSE_REMITTANCE", "Taxes and Licenses Remittance (BIR, CDC, City Treasurer of Pasig, etc.)", false],
  ["FUND_REPLENISHMENT", "Fund Replenishment (PCF, Revolving, etc.)", false],
  ["PER_DIEM_ALLOWANCE", "Per Diem/Allowance", false],
  ["PAYROLL_DISBURSEMENT", "Payroll Disbursement", true],
  ["REIMBURSEMENT", "Reimbursement (includes Notarization)", false],
  ["PAYROLL_GOVERNMENT_REMITTANCE", "Payroll Government Remittance", true],
  ["INTERCOMPANY_DM", "Intercompany DM", false],
  ["INTERCOMPANY_INVOICE", "Intercompany Invoice", false],
  ["LAST_PAY", "Last Pay", true],
  ["CONSULTANCY_FEE", "Consultancy Fee", false],
  ["INTEREST_PAYMENT", "Interest Payment (RCPS, Short-Term Loan)", false],
  ["DOLLAR_CONVERSION", "Dollar Conversion", false],
  ["COMMISSION_PAYMENT", "Commission Payment", false],
  ["FACILITATION_PAYMENT", "Facilitation Payment", false],
  ["REPRESENTATION", "Representation", false],
  ["GRATUITY", "Gratuity", false],
  ["FUND_TRANSFER", "Fund Transfer", true],
  ["ERP", "ERP", false],
] as const;

async function main() {
  const passwordHash = await hash("DemoPass!2026");
  const roles = new Map<RoleCode, string>();
  for (const code of Object.values(RoleCode)) { const role = await db.role.upsert({ where:{code},update:{name:code.replaceAll("_"," ")},create:{code,name:code.replaceAll("_"," ")} }); roles.set(code,role.id); }
  const permissions = new Map<string, string>();
  for (const code of permissionCodes) {
    const permission = await db.permission.upsert({ where: { code }, update: { name: code }, create: { code, name: code } });
    permissions.set(code, permission.id);
  }
  for (const [roleCode, grants] of Object.entries(rolePermissions)) {
    for (const permissionCode of grants) {
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roles.get(roleCode as RoleCode)!, permissionId: permissions.get(permissionCode)! } },
        update: {},
        create: { roleId: roles.get(roleCode as RoleCode)!, permissionId: permissions.get(permissionCode)! },
      });
    }
  }
  const svi=await db.company.upsert({where:{code:"SVI"},update:{},create:{code:"SVI",name:"SVI TECHNOLOGIES INC",defaultCurrency:"PHP",branding:{create:{legalDisplayName:"SVI Technologies Inc.",address:"22/F Antel Global Corporate Center, 3 Dona Julia Vargas Avenue, Ortigas Center, San Antonio, Pasig City, Philippines 1605",telephone:"(63 2) 8633 8788",fax:"(63 2) 8857 2065"}}}});
  const sampleA=await db.company.upsert({where:{code:"NOVA"},update:{},create:{code:"NOVA",name:"Nova Demo Services Inc.",branding:{create:{legalDisplayName:"Nova Demo Services Inc.",address:"Fictitious Corporate Center, Makati City",telephone:"(63 2) 8000 0101"}}}});
  const sampleB=await db.company.upsert({where:{code:"ATLAS"},update:{},create:{code:"ATLAS",name:"Atlas Sample Solutions Corp.",defaultCurrency:"USD",branding:{create:{legalDisplayName:"Atlas Sample Solutions Corp.",address:"Sample Avenue, Taguig City",telephone:"(63 2) 8000 0202"}}}});
  const dept=await db.department.upsert({where:{companyId_code:{companyId:svi.id,code:"FIN"}},update:{},create:{companyId:svi.id,code:"FIN",name:"Finance"}});
  const users=[
    ["requester1@svi.demo","Alex Rivera",RoleCode.REQUESTER],["requester2@svi.demo","Morgan Santos",RoleCode.REQUESTER],["approver@svi.demo","Jordan Reyes",RoleCode.APPROVER],["ap@svi.demo","Casey Lim",RoleCode.AP_PROCESSOR],["reviewer@svi.demo","Taylor Cruz",RoleCode.AP_REVIEWER],["admin@svi.demo","Avery Garcia",RoleCode.ADMIN],["auditor@svi.demo","Riley Mendoza",RoleCode.AUDITOR]
  ] as const;
  const ids=new Map<string,string>();
  for(const [email,fullName,roleCode] of users){const user=await db.user.upsert({where:{email},update:{passwordHash,fullName},create:{email,passwordHash,fullName,departmentId:dept.id}});ids.set(email,user.id);await db.userRole.upsert({where:{userId_roleId_companyId:{userId:user.id,roleId:roles.get(roleCode)!,companyId:svi.id}},update:{},create:{userId:user.id,roleId:roles.get(roleCode)!,companyId:svi.id}})}
  const projects=["HR","ADMIN","IT","FINANCE","BPI","DEALERSHIP","DIGITIZATION"];
  const projectIds=new Map<string,string>();for(const code of projects){const x=await db.projectCode.upsert({where:{companyId_code:{companyId:svi.id,code}},update:{},create:{companyId:svi.id,code,name:code[0]+code.slice(1).toLowerCase()}});projectIds.set(code,x.id)}
  const accounts=[["6100","Transportation"],["6110","Notary"],["6120","Meals"],["6130","Software"],["6140","Office Supplies"],["6150","Professional Fees"]] as const;
  const accountIds=new Map<string,string>();for(const [code,name] of accounts){const x=await db.account.upsert({where:{companyId_code:{companyId:svi.id,code}},update:{qbAccountId:`QB-${code}`},create:{companyId:svi.id,code,name,qbAccountId:`QB-${code}`}});accountIds.set(code,x.id)}
  const payees=[];for(const [type,name] of [["EMPLOYEE","Alex Rivera"],["VENDOR","Northstar Demo Supplies"],["EXTERNAL_COMPANY","Bluebird Sample Consulting"],["GOVERNMENT_AGENCY","Sample Revenue Agency"],["OTHER","Fictitious Community Partner"]]){payees.push(await db.payee.create({data:{companyId:svi.id,type,displayName:name}}))}
  await db.natureOfPayment.updateMany({ data: { active: false } });
  const natureIds=new Map<string,string>();for(let i=0;i<paymentTypes.length;i++){const [code,displayLabel,sensitive]=paymentTypes[i];const x=await db.natureOfPayment.upsert({where:{code},update:{displayLabel,sortOrder:i+1,sensitive,active:true},create:{code,displayLabel,sortOrder:i+1,sensitive,active:true}});natureIds.set(code,x.id)}
  const documentRules:[string,string][]=[["PAYROLL_DISBURSEMENT","PAYROLL_BREAKDOWN"],["CONSULTANCY_FEE","CONTRACT"],["FUND_REPLENISHMENT","PROOF_OF_PAYMENT"],["REIMBURSEMENT","PROOF_OF_PAYMENT"]];
  for(const [code,category] of documentRules) await db.natureOfPaymentRule.upsert({where:{natureOfPaymentId_key:{natureOfPaymentId:natureIds.get(code)!,key:`DOC_${category}`}},update:{config:{category}},create:{natureOfPaymentId:natureIds.get(code)!,key:`DOC_${category}`,label:`Required ${category}`,required:true,ruleType:"DOCUMENT_CATEGORY",config:{category}}});
  const workflow=await db.approvalWorkflow.create({data:{companyId:svi.id,name:"SVI Default Workflow",rules:{create:{priority:100,conditions:{companyId:svi.id},stageKeys:["MANAGER"]}}}});
  await db.approvalStage.createMany({data:[{workflowId:workflow.id,key:"MANAGER",name:"Manager Approval",order:1,mode:"SEQUENTIAL",requiredRole:"APPROVER"},{workflowId:workflow.id,key:"ACCOUNTING",name:"Accounting Review",order:2,mode:"SEQUENTIAL",requiredRole:"AP_REVIEWER",threshold:"100000"}]});
  for(const company of [svi,sampleA,sampleB]) for(const kind of ["DRAFT","REQUEST","INVOICE","APV"]) await db.numberSequence.create({data:{companyId:company.id,kind,prefix:kind==="REQUEST"?"RFP":kind==="INVOICE"?"INV":kind==="APV"?"APV":"IAP",resetPeriod:"ANNUAL",periodKey:"2026",nextValue:100}});
  const processStatuses: RequestStatus[] = [
    RequestStatus.DRAFT, RequestStatus.PENDING_MANAGER_APPROVAL, RequestStatus.MANAGER_APPROVED,
    RequestStatus.PENDING_AP_VALIDATION, RequestStatus.PENDING_ACCOUNTING_REVIEW, RequestStatus.ACCOUNTING_APPROVED,
    RequestStatus.READY_FOR_DOCUMENT_GENERATION, RequestStatus.DOCUMENT_GENERATED, RequestStatus.READY_FOR_QUICKBOOKS,
    RequestStatus.QUICKBOOKS_FILE_GENERATED, RequestStatus.QUICKBOOKS_POSTING_PENDING, RequestStatus.POSTED_TO_QUICKBOOKS,
    RequestStatus.PAYMENT_SCHEDULED, RequestStatus.PAYMENT_PROCESSING, RequestStatus.PAID, RequestStatus.RECONCILIATION_PENDING,
    RequestStatus.RETURNED_FOR_REVISION, RequestStatus.REJECTED, RequestStatus.CLOSED,
  ];
  const demos:[string,RequestStatus,string][]=[
    ...paymentTypes.map((x,i)=>[x[0],processStatuses[i],`${x[1]} demonstration`] as [string,RequestStatus,string]),
    ["REIMBURSEMENT",RequestStatus.RETURNED_FOR_REVISION,"Returned request"],["CONSULTANCY_FEE",RequestStatus.REJECTED,"Rejected request"],["FUND_TRANSFER",RequestStatus.PENDING_AP_VALIDATION,"Missing document"],["REIMBURSEMENT",RequestStatus.PENDING_AP_VALIDATION,"Duplicate-risk request"],["ERP",RequestStatus.PENDING_AP_VALIDATION,"Mapping exception"],["FUND_REPLENISHMENT",RequestStatus.CLOSED,"Paid and reconciled request"]
  ];
  const requester=ids.get("requester1@svi.demo")!;const approver=ids.get("approver@svi.demo")!;
  for(let i=0;i<demos.length;i++){const [nature,status,label]=demos[i];const requestNumber=`RFP-SVI-2026-${String(i+1).padStart(6,"0")}`;const request=await db.request.create({data:{draftIdentifier:`IAP-2026-${String(i+1).padStart(6,"0")}`,requestNumber,companyId:svi.id,requesterId:requester,createdById:requester,departmentId:dept.id,payeeId:payees[i%payees.length].id,natureOfPaymentId:natureIds.get(nature)!,paymentOtherText:nature==="OTHERS"?"Community event support":null,requestDate:new Date("2026-09-15"),currency:nature==="DOLLAR_PURCHASE"?"USD":"PHP",totalAmount:(1500+i*125).toString(),status,conditionalData:{demo:true},submittedAt:status!==RequestStatus.DRAFT?new Date("2026-09-15T08:00:00Z"):null,closedAt:status===RequestStatus.CLOSED?new Date("2026-09-20T08:00:00Z"):null,lines:{create:{position:0,projectCodeId:projectIds.get(projects[i%projects.length]),accountId:label==="Mapping exception"?null:accountIds.get(accounts[i%accounts.length][0]),particulars:`${label} for safe fictitious operational activity`,amount:(1500+i*125).toString()}},versions:{create:{version:1,reason:"Seed demonstration",snapshot:{label,nature}}},histories:{create:{toStatus:status,actorId:requester,requestVersion:1,reason:"Seed demonstration"}}}});await db.auditEvent.create({data:{requestId:request.id,actorId:requester,action:"SEED_REQUEST_CREATED",entityType:"Request",entityId:request.id,after:{status,label}}});if(status===RequestStatus.PENDING_MANAGER_APPROVAL){const stage=await db.approvalStage.findFirstOrThrow({where:{workflowId:workflow.id,key:"MANAGER"}});await db.approvalAssignment.create({data:{requestId:request.id,stageId:stage.id,approverId:approver,requestVersion:1,dueAt:new Date("2026-10-02")}})}if(status===RequestStatus.CLOSED){const posting=await db.quickBooksPosting.create({data:{requestId:request.id,externalTransactionId:`QB-DEMO-${i}`,manual:true,postingDate:new Date("2026-09-18"),total:request.totalAmount,evidenceStorageKey:"seed/evidence",postedById:ids.get("ap@svi.demo")!,result:"SUCCESS"}});void posting;await db.payment.create({data:{requestId:request.id,amount:request.totalAmount,status:"PAID",method:"BANK_TRANSFER",paidAt:new Date("2026-09-19"),reference:`PAY-DEMO-${i}`,processedById:ids.get("ap@svi.demo")!}});await db.reconciliation.create({data:{requestId:request.id,bankReference:`BANK-DEMO-${i}`,settlementDate:new Date("2026-09-20"),requestedAmount:request.totalAmount,postedAmount:request.totalAmount,paidAmount:request.totalAmount,settledAmount:request.totalAmount,variance:0,reconciledById:ids.get("reviewer@svi.demo")!,approvedAt:new Date("2026-09-20")}})}}
  console.log(`Seeded ${users.length} users, ${paymentTypes.length} payment types and ${demos.length} demo requests. Password: DemoPass!2026`);
}

main().finally(()=>db.$disconnect());
