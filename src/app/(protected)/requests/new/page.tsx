import { RequestForm } from "@/components/RequestForm";
import { requirePermission } from "@/lib/access";
import { db } from "@/lib/db";

export default async function NewRequest() {
  const user = await requirePermission("request.create");
  const companyScope = user.roles.includes("ADMIN") || !user.companyIds.length ? {} : { id: { in: user.companyIds } };
  const childScope = user.roles.includes("ADMIN") || !user.companyIds.length ? {} : { companyId: { in: user.companyIds } };
  const [companies, payees, projectCodes, accounts, paymentTypes] = await Promise.all([db.company.findMany({ where: { active: true, ...companyScope }, orderBy: { name: "asc" } }), db.payee.findMany({ where: { active: true, ...childScope }, orderBy: { displayName: "asc" } }), db.projectCode.findMany({ where: { active: true, ...childScope }, orderBy: { code: "asc" } }), db.account.findMany({ where: { active: true, ...childScope }, orderBy: { name: "asc" } }), db.natureOfPayment.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } })]);
  return <><span className="eyebrow">Requester workspace</span><h1>Create Request for Payment</h1><p className="muted">This layout follows the supplied SVI form while enforcing the workflow server-side.</p><RequestForm requesterName={user.name ?? ""} companies={companies.map((x) => ({ id: x.id, name: x.name, code: x.code }))} payees={payees.map((x) => ({ id: x.id, name: x.displayName }))} projectCodes={projectCodes.map((x) => ({ id: x.id, name: x.name, code: x.code }))} accounts={accounts.map((x) => ({ id: x.id, name: x.name, code: x.code }))} paymentTypes={paymentTypes}/></>;
}
