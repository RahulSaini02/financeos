import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const { name, alias, location, manager, ein, phone, hr_contact, my_start_date, grade, default_account_id, notes } = body

    const { data, error } = await supabase
      .from('employers')
      .insert({
        user_id: user.id,
        name: name.trim(),
        alias: alias ?? null,
        location: location ?? null,
        manager: manager ?? null,
        ein: ein ?? null,
        phone: phone ?? null,
        hr_contact: hr_contact ?? null,
        my_start_date: my_start_date ?? null,
        grade: grade ?? null,
        default_account_id: default_account_id ?? null,
        notes: notes ?? null,
      })
      .select()
      .single()

    if (error) {
      console.error('Employer insert error:', error)
      return NextResponse.json({ error: 'Failed to create employer' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('Employers POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.id || typeof body.id !== 'string') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const { id, ...rest } = body

    // Strip fields that must not be overwritten by the caller
    delete rest.user_id
    delete rest.created_at

    const { data, error } = await supabase
      .from('employers')
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Employer update error:', error)
      return NextResponse.json({ error: 'Failed to update employer' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Employer not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Employers PUT error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('employers')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Employer delete error:', error)
      return NextResponse.json({ error: 'Failed to delete employer' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Employers DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
