-- Rename legacy hubtel_reference column to paystack_reference (payment provider is now Paystack)
ALTER TABLE transactions RENAME COLUMN hubtel_reference TO paystack_reference;
