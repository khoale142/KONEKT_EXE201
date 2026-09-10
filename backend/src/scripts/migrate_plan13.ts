import { db } from '../db';
import { sql } from 'drizzle-orm';

async function migratePlan13() {
  console.log('🚀 Starting PLAN-13 Database Migration for Multi-Vertical Web POS...');

  try {
    // 1. Alter stores table: add pos_config jsonb
    await db.execute(sql`
      ALTER TABLE public.stores 
      ADD COLUMN IF NOT EXISTS pos_config jsonb DEFAULT '{"defaultOrderType":"dine_in","defaultServiceMode":"table","enabledServiceModes":["table","table_marker","queue_number","customer_name","none"],"autoPrintReceipt":true}'::jsonb;
    `);
    console.log('✅ Updated stores table (pos_config)');

    // 2. Alter orders table: add multi-vertical columns
    await db.execute(sql`
      ALTER TABLE public.orders 
      ADD COLUMN IF NOT EXISTS order_type varchar(50) DEFAULT 'dine_in' NOT NULL;
    `);
    await db.execute(sql`
      ALTER TABLE public.orders 
      ADD COLUMN IF NOT EXISTS service_mode varchar(50) DEFAULT 'none' NOT NULL;
    `);
    await db.execute(sql`
      ALTER TABLE public.orders 
      ADD COLUMN IF NOT EXISTS service_identifier varchar(150);
    `);
    await db.execute(sql`
      ALTER TABLE public.orders 
      ADD COLUMN IF NOT EXISTS queue_number integer;
    `);
    await db.execute(sql`
      ALTER TABLE public.orders 
      ADD COLUMN IF NOT EXISTS customer_name varchar(150);
    `);
    await db.execute(sql`
      ALTER TABLE public.orders 
      ADD COLUMN IF NOT EXISTS customer_phone varchar(50);
    `);
    await db.execute(sql`
      ALTER TABLE public.orders 
      ADD COLUMN IF NOT EXISTS discount_reason varchar(255);
    `);
    await db.execute(sql`
      ALTER TABLE public.orders 
      ADD COLUMN IF NOT EXISTS is_hold boolean DEFAULT false NOT NULL;
    `);

    // 3. Create indexes
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_orders_queue_number ON public.orders(queue_number);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_orders_is_hold ON public.orders(is_hold);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_orders_service_mode ON public.orders(service_mode);
    `);
    console.log('✅ Updated orders table (order_type, service_mode, service_identifier, queue_number, customer_name, customer_phone, discount_reason, indexes)');

    // 4. Create public.gateway_payments table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS public.gateway_payments (
        id serial PRIMARY KEY,
        order_id integer REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
        provider varchar(50) NOT NULL,
        provider_order_id varchar(255),
        request_id varchar(100) UNIQUE NOT NULL,
        amount numeric(12, 2) NOT NULL,
        status varchar(50) DEFAULT 'PENDING' NOT NULL,
        pay_url text,
        deeplink text,
        qr_code_url text,
        raw_request jsonb,
        raw_response jsonb,
        expired_at timestamptz,
        paid_at timestamptz,
        created_at timestamptz DEFAULT now() NOT NULL,
        updated_at timestamptz DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_gateway_payments_order ON public.gateway_payments(order_id);
      CREATE INDEX IF NOT EXISTS idx_gateway_payments_request ON public.gateway_payments(request_id);
      CREATE INDEX IF NOT EXISTS idx_gateway_payments_status ON public.gateway_payments(status);
    `);
    console.log('✅ Created public.gateway_payments table');

    console.log('🎉 PLAN-13 Database Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migratePlan13();
