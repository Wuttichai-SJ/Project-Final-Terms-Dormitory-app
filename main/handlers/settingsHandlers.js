const { ipcMain } = require('electron');
const { getDb } = require('../database/client');
const { appSettings } = require('../database/schema');
const { eq } = require('drizzle-orm');
const { requireAuth, requirePermission } = require('../utils/permission');

function registerSettingsHandlers() {

  // Any authenticated user can read settings (rates needed for billing preview)
  ipcMain.handle('settings:get', async () => {
    try {
      requireAuth();
      const db = getDb();
      const data = db.select().from(appSettings).where(eq(appSettings.id, 1)).get();
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Only admin can change settings — rate changes affect future bills but not past ones
  ipcMain.handle('settings:update', async (_event, payload) => {
    try {
      const session = requireAuth();
      requirePermission('settings.edit');

      const {
        dormitoryName, dormitoryAddress, dormitoryPhone,
        electricRate, waterRate, minWaterBill,
        trashFee, commonFee, internetFee,
        defaultVatRate, vatEnabled,
        dueDays, earlyTerminationPolicy,
      } = payload;

      const db = getDb();
      db.update(appSettings).set({
        dormitoryName:          dormitoryName?.trim()    ?? '',
        dormitoryAddress:       dormitoryAddress?.trim() ?? '',
        dormitoryPhone:         dormitoryPhone?.trim()   ?? '',
        electricRate:           Number(electricRate),
        waterRate:              Number(waterRate),
        minWaterBill:           Number(minWaterBill),
        trashFee:               Number(trashFee),
        commonFee:              Number(commonFee),
        internetFee:            Number(internetFee),
        defaultVatRate:         Number(defaultVatRate),
        vatEnabled:             vatEnabled ? 1 : 0,
        dueDays:                Number(dueDays),
        earlyTerminationPolicy: earlyTerminationPolicy ?? 'A',
        updatedByUserId:        session.id,
        updatedAt:              new Date().toISOString(),
      }).where(eq(appSettings.id, 1)).run();

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerSettingsHandlers };
