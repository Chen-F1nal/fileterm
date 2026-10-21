export function summarizeGpu(gpu) {
  const renderer = gpu.auxAttributes?.glRenderer ?? null
  const status = gpu.featureStatus?.webgl ?? null
  const software = /swiftshader|llvmpipe|software|warp|basic render driver/i.test(renderer ?? '')
  const hardwareAcceleration = software ? false : renderer && !/disabled|unavailable/i.test(status ?? '') ? true : null
  return {
    devices:
      gpu.devices?.map(({ vendorId, deviceId, vendorString, deviceString, driverVendor, driverVersion, active }) => ({
        vendorId,
        deviceId,
        vendorString,
        deviceString,
        driverVendor,
        driverVersion,
        active
      })) ?? [],
    glVendor: gpu.auxAttributes?.glVendor ?? null,
    glRenderer: renderer,
    glVersion: gpu.auxAttributes?.glVersion ?? null,
    glDriver: gpu.auxAttributes?.glDriver ?? null,
    glDriverVersion: gpu.auxAttributes?.glDriverVersion ?? null,
    webglStatus: status,
    hardwareAcceleration
  }
}
