import { createFileRoute } from '@tanstack/react-router'


export const Route = createFileRoute('/configuration')({
  component: Configuration,
})

function Configuration() {

  return <div>config</div>
}