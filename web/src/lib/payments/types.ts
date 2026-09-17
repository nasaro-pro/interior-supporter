export type CreateBillingCustomerInput = {
  companyId: string;
  email: string;
  name: string;
};

export type IssueInvoiceInput = {
  companyId: string;
  amount: number;
  currency: string;
};

export interface PaymentAdapter {
  createCustomer(input: CreateBillingCustomerInput): Promise<{ customerId: string }>;
  issueInvoice(input: IssueInvoiceInput): Promise<{ invoiceId: string }>;
  cancelSubscription(companyId: string): Promise<void>;
}
