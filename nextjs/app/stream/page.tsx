import { isStreamerAuthorized } from '@/lib/authz'
import { redirect } from 'next/navigation'
import StreamClient from './StreamClient'

export default async function StreamPage() {
  if (!(await isStreamerAuthorized())) {
    redirect('/login?mode=streamer&callbackUrl=/stream')
  }

  return <StreamClient />
}
