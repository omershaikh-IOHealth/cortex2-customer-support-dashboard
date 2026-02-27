import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function PUT(request, { params }) {
  try {
    const { kpi_code, kpi_name, description, calculation_method, target_value, unit, report_frequency } = await request.json()
    const result = await pool.query(`
      UPDATE test.kpi_configs
      SET kpi_code=$1, kpi_name=$2, description=$3, calculation_method=$4, target_value=$5, unit=$6, report_frequency=$7
      WHERE id=$8 RETURNING *
    `, [kpi_code, kpi_name, description, calculation_method, target_value, unit, report_frequency, params.id])
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    await pool.query('DELETE FROM test.kpi_configs WHERE id = $1', [params.id])
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
