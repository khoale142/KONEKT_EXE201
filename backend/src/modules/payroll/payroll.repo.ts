import { pool } from "../../config/db";

export const payrollRepo = {
  // 1. Get user configuration
  async getUserConfigs(userIds: number[]) {
    if (userIds.length === 0) return [];
    
    const result = await pool.query(
      `SELECT
         u.id,
         u.full_name,
         u.employment_type,
         COALESCE(u.base_salary, 0) as base_salary,
         COALESCE(u.hourly_wage, 20000) as hourly_wage,
         u.role_id,
         r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ANY($1)`,
      [userIds]
    );
    return result.rows;
  },

  // 2. Get real-time attendance stats for a specific month
  async getAttendanceStats(userIds: number[], month: number, year: number) {
     if (userIds.length === 0) return [];

     // Assuming att_attendance has classification column or late_minutes, we will use a simple rule
     // wait, let's see how late is determined. earlier code used `check_in > scheduled_start`
     // We will calculate total completed hours and count of late shifts.
     const query = `
       SELECT 
         a.user_id,
         COUNT(a.id)::integer AS total_shifts,
         COALESCE(SUM(
           COALESCE(
             CASE
               WHEN a.check_in_at IS NOT NULL AND a.check_out_at IS NOT NULL THEN
                 EXTRACT(EPOCH FROM (a.check_out_at - a.check_in_at)) / 3600.0
             END,
             CASE
               WHEN a.check_in_at IS NOT NULL
                 AND a.check_out_at IS NULL
                 AND ss.scheduled_start_at IS NOT NULL
                 AND ss.scheduled_end_at IS NOT NULL THEN
                 GREATEST(
                   0,
                   EXTRACT(EPOCH FROM (
                     ss.scheduled_end_at - GREATEST(a.check_in_at, ss.scheduled_start_at)
                   )) / 3600.0
                 )
             END,
             0
           )
         ), 0)::double precision AS total_hours,
         COUNT(*) FILTER (WHERE a.check_in_at IS NOT NULL AND ss.scheduled_start_at IS NOT NULL
           AND EXTRACT(EPOCH FROM (a.check_in_at - ss.scheduled_start_at))/60.0 > 5)::integer AS late_shifts,
         COUNT(*) FILTER (WHERE a.status = 'open' AND a.check_out_at IS NULL AND a.attendance_date < CURRENT_DATE)::integer AS missed_checkouts
       FROM staff_attendance a
       JOIN staff_schedules ss ON a.schedule_id = ss.id
       WHERE a.user_id = ANY($1)
         AND EXTRACT(MONTH FROM a.attendance_date) = $2
         AND EXTRACT(YEAR FROM a.attendance_date) = $3
         AND a.status IN ('closed', 'open')
       GROUP BY a.user_id
     `;
     const result = await pool.query(query, [userIds, month, year]);
     return result.rows;
  },

  async getScheduledStats(userIds: number[], month: number, year: number) {
    if (userIds.length === 0) return [];

    const query = `
      SELECT
        ss.user_id,
        COUNT(ss.id)::integer AS scheduled_shifts,
        COALESCE(
          SUM(EXTRACT(EPOCH FROM (ss.scheduled_end_at - ss.scheduled_start_at)) / 3600.0),
          0
        )::double precision AS scheduled_hours
      FROM staff_schedules ss
      WHERE ss.user_id = ANY($1)
        AND EXTRACT(MONTH FROM ss.work_date) = $2
        AND EXTRACT(YEAR FROM ss.work_date) = $3
        AND ss.status = 'assigned'
      GROUP BY ss.user_id
    `;
    const result = await pool.query(query, [userIds, month, year]);
    return result.rows;
  },

  // 3. Get finalized payroll records if they exist
  async getPayrollRecords(userIds: number[], month: number, year: number) {
    if (userIds.length === 0) return [];
    
    const result = await pool.query(
      `SELECT * FROM pr_payroll_records 
       WHERE user_id = ANY($1) AND month = $2 AND year = $3`,
      [userIds, month, year]
    );
    return result.rows;
  },

  // 4. Save Finalized Payroll Record
  async upsertPayrollRecord(record: any) {
    const query = `
      INSERT INTO pr_payroll_records (
        user_id, store_id, month, year, employment_type, 
        total_shifts, total_hours, hourly_wage_snapshot, base_salary_snapshot, 
        gross_salary, total_deductions, net_salary, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (user_id, month, year) DO UPDATE SET
        store_id = EXCLUDED.store_id,
        employment_type = EXCLUDED.employment_type,
        total_shifts = EXCLUDED.total_shifts,
        total_hours = EXCLUDED.total_hours,
        hourly_wage_snapshot = EXCLUDED.hourly_wage_snapshot,
        base_salary_snapshot = EXCLUDED.base_salary_snapshot,
        gross_salary = EXCLUDED.gross_salary,
        total_deductions = EXCLUDED.total_deductions,
        net_salary = EXCLUDED.net_salary,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const values = [
      record.user_id, record.store_id || null, record.month, record.year, record.employment_type,
      record.total_shifts, record.total_hours, record.hourly_wage_snapshot, record.base_salary_snapshot,
      record.gross_salary, record.total_deductions, record.net_salary, record.status
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  },

  // 5. Get Users belonging to a store
  async getStoreUsers(storeId: number) {
    const result = await pool.query(
      `SELECT us.user_id
       FROM user_stores us
       JOIN users u ON u.id = us.user_id
       JOIN roles r ON r.id = u.role_id
       WHERE us.store_id = $1
         AND r.name IN ('staff', 'shift_leader', 'store_manager')`,
      [storeId]
    );
    return result.rows.map((r) => r.user_id);
  },

  async getStorePayrollBudget(storeId: number, month: number, year: number) {
    const referenceMonth = month === 1 ? 12 : month - 1;
    const referenceYear = month === 1 ? year - 1 : year;
    const monthStart = `${referenceYear}-${String(referenceMonth).padStart(2, "0")}-01`;
    const monthEnd = referenceMonth === 12
      ? `${referenceYear + 1}-01-01`
      : `${referenceYear}-${String(referenceMonth + 1).padStart(2, "0")}-01`;

    const currMonthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const currMonthEnd = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    const result = await pool.query(
      `
        SELECT
          s.id AS store_id,
          s.name AS store_name,
          COALESCE(s.pt_payroll_pct, 10)::numeric AS pt_payroll_pct,
          $4::integer AS revenue_source_month,
          $5::integer AS revenue_source_year,
          COALESCE(rev.revenue, 0)::numeric AS revenue,
          ROUND(COALESCE(rev.revenue, 0) * COALESCE(s.pt_payroll_pct, 10) / 100)::numeric AS pt_fund_target,
          COALESCE(curr.revenue, 0)::numeric AS current_month_revenue
        FROM stores s
        LEFT JOIN (
          SELECT o.store_id, SUM(o.final_amount) AS revenue
          FROM orders o
          WHERE o.status = 'completed'
            AND o.completed_at >= $2::date
            AND o.completed_at < $3::date
          GROUP BY o.store_id
        ) rev ON rev.store_id = s.id
        LEFT JOIN (
          SELECT o.store_id, SUM(o.final_amount) AS revenue
          FROM orders o
          WHERE o.status = 'completed'
            AND o.completed_at >= $6::date
            AND o.completed_at < $7::date
          GROUP BY o.store_id
        ) curr ON curr.store_id = s.id
        WHERE s.id = $1
        LIMIT 1
      `,
      [storeId, monthStart, monthEnd, referenceMonth, referenceYear, currMonthStart, currMonthEnd]
    );

    return result.rows[0] || null;
  }
};
