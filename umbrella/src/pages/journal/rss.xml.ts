import rss from '@astrojs/rss'
import { getCollection } from 'astro:content'
import type { APIContext } from 'astro'

export async function GET(context: APIContext) {
  const posts = (await getCollection('journal', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  )

  return rss({
    title: 'The Limelight Journal',
    description:
      'Letters from the Limelight: notes on craft, the build of Inkwell, and the books we are betting on.',
    site: context.site ?? 'https://enterthelimelight.com',
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/journal/${post.slug}`,
      categories: post.data.tags,
    })),
    customData: '<language>en-us</language>',
  })
}
