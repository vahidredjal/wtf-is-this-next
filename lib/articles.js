import { supabase } from './supabaseClient';

export async function getPublishedArticles() {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false });
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

export async function getArticleById(id) {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error(error);
    return null;
  }
  return data;
}

export async function getHeroId() {
  const { data, error } = await supabase
    .from('site_settings')
    .select('hero_article_id')
    .eq('id', true)
    .maybeSingle();
  if (error) {
    console.error(error);
    return null;
  }
  return data ? data.hero_article_id : null;
}
