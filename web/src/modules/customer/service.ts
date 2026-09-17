import { z } from "zod";
import { isStaff, type DataContext } from "@/lib/tenancy/context";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import {
  findCustomerById,
  insertCustomer,
  updateCustomerRow,
} from "@/modules/customer/repo";

export const customerInput = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(30).optional(),
  email: z.union([z.email(), z.literal("")]).optional(),
  memo: z.string().max(2000).optional(),
});

function emptyToUndef(v: string | undefined) {
  const t = v?.trim();
  return t ? t : undefined;
}

export async function createCustomer(
  ctx: DataContext,
  raw: z.infer<typeof customerInput>,
) {
  if (!isStaff(ctx)) throw new ForbiddenError();
  const input = customerInput.parse(raw);
  return insertCustomer(ctx, {
    companyId: ctx.companyId,
    name: input.name,
    phone: emptyToUndef(input.phone),
    email: emptyToUndef(input.email),
    memo: emptyToUndef(input.memo),
  });
}

export async function updateCustomer(
  ctx: DataContext,
  customerId: string,
  raw: z.infer<typeof customerInput>,
) {
  if (!isStaff(ctx)) throw new ForbiddenError();
  const input = customerInput.parse(raw);
  const existing = await findCustomerById(ctx, customerId);
  if (!existing) throw new NotFoundError();
  const row = await updateCustomerRow(ctx, customerId, {
    name: input.name,
    phone: emptyToUndef(input.phone),
    email: emptyToUndef(input.email),
    memo: emptyToUndef(input.memo),
  });
  if (!row) throw new NotFoundError();
  return row;
}
