import { useCallback, useEffect, useState } from 'react'
import { supabase, type Tables } from '../lib/supabase'

export type Member = { user_id: string; role: string; active: boolean; full_name: string; color: string; phone: string | null }

export function useMembers(orgId: string) {
  const [members, setMembers] = useState<Member[]>([])
  const load = useCallback(async () => {
    const { data } = await supabase
      .from('organization_members')
      .select('user_id, role, active, profiles(full_name, color, phone)')
      .eq('organization_id', orgId)
    setMembers(
      (data ?? [])
        .map((m) => {
          const p = m.profiles as unknown as Pick<Tables<'profiles'>, 'full_name' | 'color' | 'phone'> | null
          return { user_id: m.user_id, role: m.role, active: m.active, full_name: p?.full_name ?? '?', color: p?.color ?? '#0e7490', phone: p?.phone ?? null }
        })
        .sort((a, b) => a.full_name.localeCompare(b.full_name, 'fi')),
    )
  }, [orgId])
  useEffect(() => {
    void load()
  }, [load])
  return { members, installers: members.filter((m) => m.active), reload: load }
}

/** Kuuntelee taulumuutoksia ja kutsuu reloadia (viivästettynä, jotta purskeet yhdistyvät). */
export function useRealtime(name: string, tables: string[], reload: () => void) {
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null
    const debounced = () => {
      if (t) clearTimeout(t)
      t = setTimeout(reload, 400)
    }
    let ch = supabase.channel(name)
    for (const table of tables) {
      ch = ch.on('postgres_changes', { event: '*', schema: 'public', table }, debounced)
    }
    ch.subscribe()
    return () => {
      if (t) clearTimeout(t)
      void supabase.removeChannel(ch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, reload])
}

export type ProductLite = Pick<Tables<'products'>, 'id' | 'name' | 'sku' | 'sku_type' | 'unit' | 'price' | 'category'>

export function useProducts(orgId: string) {
  const [products, setProducts] = useState<ProductLite[]>([])
  useEffect(() => {
    void supabase
      .from('products')
      .select('id, name, sku, sku_type, unit, price, category')
      .eq('organization_id', orgId)
      .eq('active', true)
      .order('name')
      .then(({ data }) => setProducts(data ?? []))
  }, [orgId])
  return products
}
