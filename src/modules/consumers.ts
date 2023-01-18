import type { Dependencies } from '../infrastructure/diConfig'

export function getConsumers(dependencies: Dependencies) {
  const { permissionConsumer } = dependencies

  return [permissionConsumer]
}
