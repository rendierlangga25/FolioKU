import assert from 'node:assert/strict'
import * as c from './calc.js'
// Data nyata dari Excel: DUTRO 75, 3 Agu 2026 (CEPI + RANTA, solar 6800)
const t1 = { driver1_id: 'cepi', driver2_id: 'ranta', km_start: 185559, km_end: 185701, fuel_amount: 180000, fuel_price: 6800, toll_amount: 0, parking_amount: 0, total_cost: 180000, destinations: ['ADM SUNTER'], vehicle_id: 'v1' }
const t2 = { driver1_id: 'cepi', driver2_id: null, km_start: 185839, km_end: 185985, fuel_amount: 180000, fuel_price: 6800, toll_amount: 0, parking_amount: 0, total_cost: 180000, destinations: ['ADM SUNTER'], vehicle_id: 'v1' }
assert.equal(c.distance(t1), 142)
assert.ok(Math.abs(c.kmPerLiter(t1) - 5.3644) < 1e-3)   // sama dengan Excel (5,364)
assert.equal(c.driverDistance(t1), 71)                  // 2 driver -> dibagi 2
assert.equal(c.driverFuel(t1), 90000)                   // D1 B / D2 B = 90.000
assert.ok(Math.abs(c.driverKmPerLiter(t1) - 2.6822) < 1e-3)
assert.equal(c.driverDistance(t2), 146)                 // 1 driver -> tidak dibagi
assert.equal(c.driverFuel(t2), 180000)
assert.equal(c.totalCost(180000, 25000, ''), 205000)
const s = c.summarizeByVehicle([t1, t2], [{ id: 'v1' }], [{ id: 'cepi', name: 'CEPI' }, { id: 'ranta', name: 'RANTA' }])
assert.equal(s[0].distance, 288); assert.equal(s[0].destinations, 2)
assert.equal(s[0].drivers.find((d) => d.name === 'CEPI').distance, 217)
console.log('calc OK')
