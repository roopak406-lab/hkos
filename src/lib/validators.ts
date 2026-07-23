import { z } from 'zod';

/** Indian mobile number (10 digits, optional +91). */
const phoneSchema = z
  .string()
  .trim()
  .regex(/^(\+?91)?[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');

/** Public checkout payload (customer page). */
export const placeOrderSchema = z.object({
  kitchenId: z.string().uuid(),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  deliverySlotId: z.string().uuid(),
  customer: z.object({
    name: z.string().trim().min(2, 'Please enter your name'),
    phone: phoneSchema,
    flatNumber: z.string().trim().min(1, 'Flat number is required'),
    tower: z.string().trim().optional().default(''),
  }),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        variant_id: z.string().uuid().nullable(),
        quantity: z.number().int().min(1),
        note: z.string().trim().optional().default(''),
      }),
    )
    .min(1, 'Your cart is empty'),
  specialInstructions: z.string().trim().max(500).optional().default(''),
});
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

/** Admin: create/edit a product. */
export const productSchema = z.object({
  name: z.string().trim().min(2),
  categoryId: z.string().uuid().nullable(),
  description: z.string().trim().max(300).optional().default(''),
  defaultPrice: z.coerce.number().min(0),
  isAlwaysAvailable: z.boolean().default(false),
  imageUrl: z.string().url().optional().or(z.literal('')),
});
export type ProductInput = z.infer<typeof productSchema>;

/** Admin: log an expense. */
export const expenseSchema = z.object({
  expenseCategoryId: z.string().uuid(),
  amount: z.coerce.number().min(0.01),
  note: z.string().trim().max(200).optional().default(''),
  spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;
