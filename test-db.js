import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  console.log('Verificando auth.users...');
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers().catch(() => ({ data: null, error: 'Requer service_role key para auth.admin' }));
  
  if (authError) {
    console.log('Não foi possível ler auth.users com anon key (esperado). Tentando public.users...');
  } else {
    console.log('Auth Users:', authUsers?.users?.length || 0);
  }

  console.log('Verificando public.users...');
  const { data: users, error: usersError } = await supabase.from('users').select('*');
  if (usersError) {
    console.error('Erro ao ler public.users:', usersError);
  } else {
    console.log(`Encontrados ${users.length} registros em public.users.`);
    if (users.length > 0) {
      console.log('Amostra:', users[0]);
    }
  }
}

checkData();
