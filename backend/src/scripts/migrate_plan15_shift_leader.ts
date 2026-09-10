import { db } from '../db';
import { sql } from 'drizzle-orm';

async function migratePlan15() {
  console.log('🚀 Starting PLAN-15 Database Migration for Shift Leader role...');

  try {
    // 1. Kiểm tra và thêm shift_leader vào user_role enum
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'user_role' AND e.enumlabel = 'shift_leader'
        ) THEN
          ALTER TYPE public.user_role ADD VALUE 'shift_leader' BEFORE 'staff';
          RAISE NOTICE 'Added shift_leader to user_role enum';
        ELSE
          RAISE NOTICE 'shift_leader already exists in user_role enum';
        END IF;
      END $$;
    `);
    console.log('✅ Updated user_role enum successfully (added shift_leader)');

    // 2. Đảm bảo bảng store_join_requests có đầy đủ các cột và indexes
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS public.store_join_requests (
        id serial PRIMARY KEY,
        tenant_id integer REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
        store_id integer REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
        user_id integer REFERENCES public.users(id) ON DELETE SET NULL,
        email varchar(255) NOT NULL,
        full_name varchar(255) NOT NULL,
        phone varchar(20),
        desired_position varchar(100),
        note text,
        status varchar(20) DEFAULT 'pending' NOT NULL,
        assigned_role varchar(50),
        custom_permissions jsonb,
        approved_by integer REFERENCES public.users(id) ON DELETE SET NULL,
        rejected_reason text,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    console.log('✅ Verified store_join_requests table');

    console.log('🎉 PLAN-15 Migration Completed Successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ PLAN-15 Migration failed:', error);
    process.exit(1);
  }
}

migratePlan15();
