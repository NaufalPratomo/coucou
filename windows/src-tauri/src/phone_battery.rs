// Native Bluetooth LE Phone Battery & Proximity poller using Windows cfgmgr32
#![cfg_attr(not(windows), allow(dead_code))]

use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub const BATTERY_EVENT: &str = "phone-battery";

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct PhoneBatteryInfo {
    pub device_id: String,
    pub level: u8,
    pub connected: bool,
}

static LAST_BATTERY: Mutex<Option<PhoneBatteryInfo>> = Mutex::new(None);

#[tauri::command]
pub fn get_phone_battery() -> Option<PhoneBatteryInfo> {
    LAST_BATTERY.lock().ok().and_then(|guard| guard.clone())
}

pub fn setup(app: &AppHandle) {
    #[cfg(windows)]
    start_poller(app.clone());
    #[cfg(not(windows))]
    let _ = app;
}

#[cfg(windows)]
fn start_poller(app: AppHandle) {
    std::thread::Builder::new()
        .name("coucou-phone-battery".into())
        .spawn(move || {
            loop {
                match query_ble_battery() {
                    Some(info) => {
                        let mut changed = false;
                        if let Ok(mut last) = LAST_BATTERY.lock() {
                            if *last != Some(info.clone()) {
                                *last = Some(info.clone());
                                changed = true;
                            }
                        }
                        if changed {
                            let _ = app.emit(BATTERY_EVENT, &info);
                        }
                    }
                    None => {
                        let mut disconnected_info = None;
                        if let Ok(mut last) = LAST_BATTERY.lock() {
                            if let Some(prev) = last.as_mut() {
                                if prev.connected {
                                    prev.connected = false;
                                    disconnected_info = Some(prev.clone());
                                }
                            }
                        }
                        if let Some(info) = disconnected_info {
                            let _ = app.emit(BATTERY_EVENT, &info);
                        }
                    }
                }
                std::thread::sleep(Duration::from_secs(10));
            }
        })
        .expect("failed to spawn phone battery poller");
}

#[cfg(windows)]
#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct GUID {
    data1: u32,
    data2: u16,
    data3: u16,
    data4: [u8; 8],
}

#[cfg(windows)]
#[repr(C)]
#[derive(Clone, Copy, Debug)]
struct DEVPROPKEY {
    fmtid: GUID,
    pid: u32,
}

// {104EA319-6EE2-4701-BD47-8DDBF425BBE5} 2 = DEVPKEY_Device_BatteryPercentage
#[cfg(windows)]
const DEVPKEY_DEVICE_BATTERY_PERCENTAGE: DEVPROPKEY = DEVPROPKEY {
    fmtid: GUID {
        data1: 0x104EA319,
        data2: 0x6EE2,
        data3: 0x4701,
        data4: [0xBD, 0x47, 0x8D, 0xDB, 0xF4, 0x25, 0xBB, 0xE5],
    },
    pid: 2,
};

// {995EF0B0-7EB3-4A8B-B9CE-068BB3F4AF69} 4 = DEVPKEY_Device_IsConnected
#[cfg(windows)]
const DEVPKEY_DEVICE_IS_CONNECTED: DEVPROPKEY = DEVPROPKEY {
    fmtid: GUID {
        data1: 0x995EF0B0,
        data2: 0x7EB3,
        data3: 0x4A8B,
        data4: [0xB9, 0xCE, 0x06, 0x8B, 0xB3, 0xF4, 0xAF, 0x69],
    },
    pid: 4,
};

#[cfg(windows)]
const CM_GETIDLIST_FILTER_ENUMERATOR: u32 = 0x00000001;
#[cfg(windows)]
const CR_SUCCESS: u32 = 0;

#[cfg(windows)]
#[link(name = "cfgmgr32")]
extern "system" {
    fn CM_Get_Device_ID_List_SizeW(
        pul_len: *mut u32,
        psz_filter: *const u16,
        ul_flags: u32,
    ) -> u32;

    fn CM_Get_Device_ID_ListW(
        psz_filter: *const u16,
        buffer: *mut u16,
        buffer_len: u32,
        ul_flags: u32,
    ) -> u32;

    fn CM_Locate_DevNodeW(
        p_dev_inst: *mut u32,
        p_device_id: *const u16,
        ul_flags: u32,
    ) -> u32;

    fn CM_Get_DevNode_PropertyW(
        dn_dev_inst: u32,
        property_key: *const DEVPROPKEY,
        property_type: *mut u32,
        property_buffer: *mut u8,
        property_buffer_size: *mut u32,
        ul_flags: u32,
    ) -> u32;
}

#[cfg(windows)]
pub fn query_ble_battery() -> Option<PhoneBatteryInfo> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    let filter: Vec<u16> = "BTHLE\0".encode_utf16().collect();
    let mut len: u32 = 0;

    let res = unsafe {
        CM_Get_Device_ID_List_SizeW(&mut len, filter.as_ptr(), CM_GETIDLIST_FILTER_ENUMERATOR)
    };
    if res != CR_SUCCESS || len == 0 {
        return None;
    }

    let mut buf: Vec<u16> = vec![0; len as usize];
    let res = unsafe {
        CM_Get_Device_ID_ListW(filter.as_ptr(), buf.as_mut_ptr(), len, CM_GETIDLIST_FILTER_ENUMERATOR)
    };
    if res != CR_SUCCESS {
        return None;
    }

    // Parse multi-sz buffer (null-separated strings terminated by double null)
    let mut devices: Vec<String> = Vec::new();
    let mut start = 0;
    for i in 0..buf.len() {
        if buf[i] == 0 {
            if i > start {
                let slice = &buf[start..i];
                let s = OsString::from_wide(slice).to_string_lossy().to_string();
                if !s.is_empty() {
                    devices.push(s);
                }
            }
            start = i + 1;
        }
    }

    let mut candidate: Option<PhoneBatteryInfo> = None;

    for dev_id in devices {
        let wide_id: Vec<u16> = dev_id.encode_utf16().chain(std::iter::once(0)).collect();
        let mut dev_inst: u32 = 0;
        let loc_res = unsafe { CM_Locate_DevNodeW(&mut dev_inst, wide_id.as_ptr(), 0) };
        if loc_res != CR_SUCCESS {
            continue;
        }

        // Query Battery
        let mut prop_type: u32 = 0;
        let mut battery_buf = [0u8; 16];
        let mut battery_size: u32 = 16;
        let batt_res = unsafe {
            CM_Get_DevNode_PropertyW(
                dev_inst,
                &DEVPKEY_DEVICE_BATTERY_PERCENTAGE,
                &mut prop_type,
                battery_buf.as_mut_ptr(),
                &mut battery_size,
                0,
            )
        };

        if batt_res == CR_SUCCESS && battery_size > 0 {
            let level = battery_buf[0];

            // Query Connection Status
            let mut conn_buf = [0u8; 16];
            let mut conn_size: u32 = 16;
            let conn_res = unsafe {
                CM_Get_DevNode_PropertyW(
                    dev_inst,
                    &DEVPKEY_DEVICE_IS_CONNECTED,
                    &mut prop_type,
                    conn_buf.as_mut_ptr(),
                    &mut conn_size,
                    0,
                )
            };
            let connected = conn_res == CR_SUCCESS && conn_size > 0 && conn_buf[0] != 0;

            let info = PhoneBatteryInfo {
                device_id: dev_id.clone(),
                level,
                connected,
            };

            // If this is the known NOFFF device (containing 4789559B9584), prioritize it immediately
            if dev_id.to_uppercase().contains("4789559B9584") {
                return Some(info);
            }

            if candidate.is_none() || (!candidate.as_ref().unwrap().connected && info.connected) {
                candidate = Some(info);
            }
        }
    }

    candidate
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(windows)]
    fn test_query_ble_battery() {
        let batt = query_ble_battery();
        println!("query_ble_battery returned: {:?}", batt);
        if let Some(info) = batt {
            assert!(info.level <= 100);
        }
    }
}
