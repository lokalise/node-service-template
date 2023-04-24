import type { Dependencies } from '../infrastructure/diConfig'

export function getPublishers(dependencies: Dependencies) {
  const { permissionPublisher } = dependencies

  return [permissionPublisher]
}
