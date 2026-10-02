import { notFound } from "next/navigation";
import { RequestForm } from "@/components/RequestForm";
import { requireUser } from "@/lib/access";
import { db } from "@/lib/db";

export default async function EditRequest({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(); const { id } = await params;
  const row = await db.request.findUnique({ where: { id }, include: { natureOfPayment: true, lines: { orderBy: { position: "asc" } }, requester: true } });
  if (!row) notFound(); if (row.requesterId !== user.id && !user.roles.includes("ADMIN")) return <div className="notice">Only the requester may edit this record.</div>; if (!["DRAFT","RETURNED_FOR_REVISION","RETURNED_BY_AP"].includes(row.status)) return <div className="notice">This request is locked in status {row.status.replaceAll("_"," ")}.</div>;
  const [companies,payees,projectCodes,accounts,paymentTypes]=await Promise.all([db.company.findMany({where:{active:true},orderBy:{name:"asc"}}),db.payee.findMany({where:{active:true},orderBy:{displayName:"asc"}}),db.projectCode.findMany({where:{active:true},orderBy:{code:"asc"}}),db.account.findMany({where:{active:true},orderBy:{name:"asc"}}),db.natureOfPayment.findMany({where:{active:true},orderBy:{sortOrder:"asc"}})]);
  return <><span className="eyebrow">Version {row.currentVersion}</span><h1>Edit Request for Payment</h1><RequestForm requestId={row.id} requesterName={row.requester.fullName} companies={companies.map(x=>({id:x.id,name:x.name,code:x.code}))} payees={payees.map(x=>({id:x.id,name:x.displayName}))} projectCodes={projectCodes.map(x=>({id:x.id,name:x.name,code:x.code}))} accounts={accounts.map(x=>({id:x.id,name:x.name,code:x.code}))} paymentTypes={paymentTypes} initial={{companyId:row.companyId,requestDate:row.requestDate.toISOString().slice(0,10),payeeId:row.payeeId,currency:row.currency,natureOfPaymentCode:row.natureOfPayment.code,paymentOtherText:row.paymentOtherText??"",conditionalData:(row.conditionalData as Record<string,string>)??{},lines:row.lines.map(line=>({projectCodeId:line.projectCodeId??"",accountId:line.accountId??"",particulars:line.particulars,amount:line.amount.toString()}))}}/></>;
}
