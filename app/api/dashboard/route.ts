import { NextResponse } from 'next/server'
import { requirePermissionAny, handleApiError } from '@/lib/api-auth'
import { DASHBOARD_ACCESS_PERMISSIONS } from '@/lib/page-permissions'
import { getDashboardMetrics } from '@/lib/dashboard/metrics'

export async function GET() {
  try {
    const user = await requirePermissionAny(...DASHBOARD_ACCESS_PERMISSIONS)
    const data = await getDashboardMetrics(user.permissions)
    return NextResponse.json(data)
  } catch (error) {
    return handleApiError(error)
  }
}
