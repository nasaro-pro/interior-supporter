import { NotImplementedError } from "@/lib/errors";
import type {
  CreateBillingCustomerInput,
  IssueInvoiceInput,
  PaymentAdapter,
} from "@/lib/payments/types";

export type { PaymentAdapter } from "@/lib/payments/types";

export function getPaymentAdapter(): PaymentAdapter {
  return {
    async createCustomer(_input: CreateBillingCustomerInput) {
      throw new NotImplementedError("PaymentAdapter.createCustomer");
    },
    async issueInvoice(_input: IssueInvoiceInput) {
      throw new NotImplementedError("PaymentAdapter.issueInvoice");
    },
    async cancelSubscription(_companyId: string) {
      throw new NotImplementedError("PaymentAdapter.cancelSubscription");
    },
  };
}
