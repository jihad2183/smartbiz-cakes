import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useSiteContent() {
  return useQuery({ queryKey: ['site-content'], queryFn: async () => {
    const { data, error } = await supabase.from('site_content').select('*');
    if (error) throw error;
    return Object.fromEntries((data ?? []).map(row => [row.key, row.value]));
  }});
}