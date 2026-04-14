import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ubmxstufxyeimaywcevk.supabase.co'
const supabaseKey = 'sb_publishable_YbIHzqpnFXin94E1bpVUug_c_B-UvTw'

export const supabase = createClient(supabaseUrl, supabaseKey)