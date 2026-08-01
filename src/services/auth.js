import { supabaseClient } from './supabaseClient.js'
import { api } from '../api.js'

export const authEnabled = supabaseClient.USE_SUPABASE

export async function getSession() {
  if (!supabaseClient.supabase) return null
  const { data } = await supabaseClient.supabase.auth.getSession()
  return data.session
}

export async function getCurrentUser() {
  if (!supabaseClient.supabase) return null
  const { data } = await supabaseClient.supabase.auth.getUser()
  return data.user || null
}

export async function signIn(email, password) {
  if (!supabaseClient.supabase) throw new Error('Authentication is not configured')
  const { error } = await supabaseClient.supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  return true
}

export async function signUp(email, password) {
  if (!supabaseClient.supabase) throw new Error('Authentication is not configured')
  const { data, error } = await supabaseClient.supabase.auth.signUp({ email, password })
  if (error) throw new Error(error.message)
  return data
}

export async function signOut() {
  if (!supabaseClient.supabase) return
  await supabaseClient.supabase.auth.signOut()
}

export async function getUserRole() {
  if (!authEnabled) return 'admin'
  const user = await getCurrentUser()
  if (!user) return null
  const { data, error } = await supabaseClient.supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (error) throw new Error(error.message)
  return data?.role || 'viewer'
}

export async function setUserRole(userId, role) {
  if (!authEnabled) throw new Error('Roles require the Supabase backend')
  return api.put('/api/profiles/' + userId, { role })
}

export async function listProfiles() {
  if (!authEnabled) throw new Error('Roles require the Supabase backend')
  return api.get('/api/profiles')
}

export function onAuthChange(cb) {
  if (!supabaseClient.supabase) {
    cb('SIGNED_OUT', null)
    return () => {}
  }
  const { data } = supabaseClient.supabase.auth.onAuthStateChange(cb)
  return () => data.subscription.unsubscribe()
}
