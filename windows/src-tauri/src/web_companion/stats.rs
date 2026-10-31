use std::sync::{LazyLock, Mutex};
use super::protocol::PcStats;

#[cfg(windows)]
mod imp {
    use super::*;

    #[repr(C)]
    #[derive(Default, Clone, Copy)]
    struct FileTime {
        dw_low_date_time: u32,
        dw_high_date_time: u32,
    }

    #[repr(C)]
    struct MemoryStatusEx {
        dw_length: u32,
        dw_memory_load: u32,
        ull_total_phys: u64,
        ull_avail_phys: u64,
        ull_total_page_file: u64,
        ull_avail_page_file: u64,
        ull_total_virtual: u64,
        ull_avail_virtual: u64,
        ull_avail_extended_virtual: u64,
    }

    extern "system" {
        fn GetSystemTimes(
            lp_idle_time: *mut FileTime,
            lp_kernel_time: *mut FileTime,
            lp_user_time: *mut FileTime,
        ) -> i32;

        fn GlobalMemoryStatusEx(lp_buffer: *mut MemoryStatusEx) -> i32;
        fn GetTickCount64() -> u64;

        fn LoadLibraryA(lp_lib_file_name: *const u8) -> usize;
        fn GetProcAddress(h_module: usize, lp_proc_name: *const u8) -> usize;
    }

    fn ft_to_u64(ft: &FileTime) -> u64 {
        ((ft.dw_high_date_time as u64) << 32) | (ft.dw_low_date_time as u64)
    }

    struct CpuSampler {
        prev_idle: u64,
        prev_kernel: u64,
        prev_user: u64,
        last_percent: f32,
    }

    static CPU_SAMPLER: LazyLock<Mutex<CpuSampler>> = LazyLock::new(|| {
        let mut idle = FileTime::default();
        let mut kernel = FileTime::default();
        let mut user = FileTime::default();
        unsafe {
            GetSystemTimes(&mut idle, &mut kernel, &mut user);
        }
        Mutex::new(CpuSampler {
            prev_idle: ft_to_u64(&idle),
            prev_kernel: ft_to_u64(&kernel),
            prev_user: ft_to_u64(&user),
            last_percent: 0.0,
        })
    });

    pub fn sample_cpu() -> f32 {
        let mut idle = FileTime::default();
        let mut kernel = FileTime::default();
        let mut user = FileTime::default();
        unsafe {
            if GetSystemTimes(&mut idle, &mut kernel, &mut user) == 0 {
                return 0.0;
            }
        }
        let cur_idle = ft_to_u64(&idle);
        let cur_kernel = ft_to_u64(&kernel);
        let cur_user = ft_to_u64(&user);

        let mut lock = CPU_SAMPLER.lock().unwrap();
        let idle_diff = cur_idle.saturating_sub(lock.prev_idle);
        let kernel_diff = cur_kernel.saturating_sub(lock.prev_kernel);
        let user_diff = cur_user.saturating_sub(lock.prev_user);

        lock.prev_idle = cur_idle;
        lock.prev_kernel = cur_kernel;
        lock.prev_user = cur_user;

        // In Windows, kernel time includes idle time
        let total_sys = kernel_diff + user_diff;
        if total_sys > 0 {
            let busy = total_sys.saturating_sub(idle_diff);
            let pct = ((busy as f64 / total_sys as f64) * 100.0) as f32;
            let clamped = ((pct * 10.0).round() / 10.0).clamp(0.0, 100.0);
            lock.last_percent = clamped;
            clamped
        } else {
            lock.last_percent
        }
    }

    pub fn sample_ram() -> (f32, f32, f32) {
        unsafe {
            let mut status = MemoryStatusEx {
                dw_length: std::mem::size_of::<MemoryStatusEx>() as u32,
                dw_memory_load: 0,
                ull_total_phys: 0,
                ull_avail_phys: 0,
                ull_total_page_file: 0,
                ull_avail_page_file: 0,
                ull_total_virtual: 0,
                ull_avail_virtual: 0,
                ull_avail_extended_virtual: 0,
            };
            if GlobalMemoryStatusEx(&mut status) != 0 && status.ull_total_phys > 0 {
                let total_gb = ((status.ull_total_phys as f64 / 1_073_741_824.0 * 10.0).round() / 10.0) as f32;
                let used_bytes = status.ull_total_phys.saturating_sub(status.ull_avail_phys);
                let used_gb = ((used_bytes as f64 / 1_073_741_824.0 * 10.0).round() / 10.0) as f32;
                let pct = ((used_bytes as f64 / status.ull_total_phys as f64 * 1000.0).round() / 10.0) as f32;
                return (used_gb, total_gb, pct.clamp(0.0, 100.0));
            }
        }
        (0.0, 0.0, 0.0)
    }

    pub fn sample_uptime() -> u64 {
        unsafe { GetTickCount64() / 1000 }
    }

    // NVML Dynamic Loader for GPU metrics
    #[repr(C)]
    #[derive(Default)]
    struct NvmlUtilization {
        gpu: u32,
        memory: u32,
    }

    type NvmlInitFn = unsafe extern "C" fn() -> i32;
    type NvmlDeviceGetHandleByIndexFn = unsafe extern "C" fn(u32, *mut usize) -> i32;
    type NvmlDeviceGetNameFn = unsafe extern "C" fn(usize, *mut u8, u32) -> i32;
    type NvmlDeviceGetTemperatureFn = unsafe extern "C" fn(usize, u32, *mut u32) -> i32;
    type NvmlDeviceGetUtilizationRatesFn = unsafe extern "C" fn(usize, *mut NvmlUtilization) -> i32;

    struct NvmlProcs {
        get_temp: NvmlDeviceGetTemperatureFn,
        get_util: NvmlDeviceGetUtilizationRatesFn,
        device: usize,
        name: String,
    }

    static NVML_STATE: LazyLock<Option<NvmlProcs>> = LazyLock::new(|| {
        unsafe {
            let lib = LoadLibraryA(b"nvml.dll\0".as_ptr());
            if lib == 0 {
                return None;
            }
            let init_sym = GetProcAddress(lib, b"nvmlInit_v2\0".as_ptr());
            let handle_sym = GetProcAddress(lib, b"nvmlDeviceGetHandleByIndex_v2\0".as_ptr());
            let name_sym = GetProcAddress(lib, b"nvmlDeviceGetName\0".as_ptr());
            let temp_sym = GetProcAddress(lib, b"nvmlDeviceGetTemperature\0".as_ptr());
            let util_sym = GetProcAddress(lib, b"nvmlDeviceGetUtilizationRates\0".as_ptr());

            if init_sym == 0 || handle_sym == 0 || name_sym == 0 || temp_sym == 0 || util_sym == 0 {
                return None;
            }

            let init_fn: NvmlInitFn = std::mem::transmute(init_sym);
            if init_fn() != 0 {
                return None;
            }

            let get_handle: NvmlDeviceGetHandleByIndexFn = std::mem::transmute(handle_sym);
            let get_name: NvmlDeviceGetNameFn = std::mem::transmute(name_sym);
            let get_temp: NvmlDeviceGetTemperatureFn = std::mem::transmute(temp_sym);
            let get_util: NvmlDeviceGetUtilizationRatesFn = std::mem::transmute(util_sym);

            let mut device = 0usize;
            if get_handle(0, &mut device) != 0 {
                return None;
            }

            let mut name_buf = [0u8; 64];
            let name = if get_name(device, name_buf.as_mut_ptr(), 64) == 0 {
                let len = name_buf.iter().position(|&b| b == 0).unwrap_or(name_buf.len());
                String::from_utf8_lossy(&name_buf[..len]).to_string()
            } else {
                "GPU".to_string()
            };

            Some(NvmlProcs {
                get_temp,
                get_util,
                device,
                name,
            })
        }
    });

    pub fn sample_gpu() -> (Option<f32>, Option<f32>, Option<String>) {
        if let Some(ref nvml) = *NVML_STATE {
            unsafe {
                let mut util = NvmlUtilization::default();
                let mut temp = 0u32;
                let util_ok = (nvml.get_util)(nvml.device, &mut util) == 0;
                let temp_ok = (nvml.get_temp)(nvml.device, 0, &mut temp) == 0;

                let gpu_pct = if util_ok { Some(util.gpu as f32) } else { None };
                let gpu_temp = if temp_ok && temp > 0 && temp < 120 { Some(temp as f32) } else { None };
                return (gpu_pct, gpu_temp, Some(nvml.name.clone()));
            }
        }
        (None, None, None)
    }

    // PDH for CPU Temperature
    #[repr(C)]
    struct PdhFmtCountervalueDouble {
        _c_status: u32,
        _padding: u32,
        double_value: f64,
    }

    type PdhOpenQueryWFn = unsafe extern "system" fn(usize, usize, *mut usize) -> i32;
    type PdhAddCounterWFn = unsafe extern "system" fn(usize, *const u16, usize, *mut usize) -> i32;
    type PdhCollectQueryDataFn = unsafe extern "system" fn(usize) -> i32;
    type PdhGetFormattedCounterValueFn = unsafe extern "system" fn(usize, u32, *mut u32, *mut PdhFmtCountervalueDouble) -> i32;
    type PdhCloseQueryFn = unsafe extern "system" fn(usize) -> i32;

    struct PdhProcs {
        collect: PdhCollectQueryDataFn,
        get_val: PdhGetFormattedCounterValueFn,
        query: usize,
        counter: usize,
    }

    unsafe impl Send for PdhProcs {}

    static PDH_STATE: LazyLock<Mutex<Option<PdhProcs>>> = LazyLock::new(|| {
        unsafe {
            let lib = LoadLibraryA(b"pdh.dll\0".as_ptr());
            if lib == 0 {
                return Mutex::new(None);
            }
            let open_sym = GetProcAddress(lib, b"PdhOpenQueryW\0".as_ptr());
            let add_sym = GetProcAddress(lib, b"PdhAddCounterW\0".as_ptr());
            let collect_sym = GetProcAddress(lib, b"PdhCollectQueryData\0".as_ptr());
            let get_sym = GetProcAddress(lib, b"PdhGetFormattedCounterValue\0".as_ptr());
            let close_sym = GetProcAddress(lib, b"PdhCloseQuery\0".as_ptr());

            if open_sym == 0 || add_sym == 0 || collect_sym == 0 || get_sym == 0 || close_sym == 0 {
                return Mutex::new(None);
            }

            let open_query: PdhOpenQueryWFn = std::mem::transmute(open_sym);
            let add_counter: PdhAddCounterWFn = std::mem::transmute(add_sym);
            let collect: PdhCollectQueryDataFn = std::mem::transmute(collect_sym);
            let get_val: PdhGetFormattedCounterValueFn = std::mem::transmute(get_sym);
            let close_query: PdhCloseQueryFn = std::mem::transmute(close_sym);

            let mut query = 0usize;
            if open_query(0, 0, &mut query) != 0 {
                return Mutex::new(None);
            }

            let path: [u16; 49] = [
                '\\' as u16, 'T' as u16, 'h' as u16, 'e' as u16, 'r' as u16, 'm' as u16, 'a' as u16, 'l' as u16,
                ' ' as u16, 'Z' as u16, 'o' as u16, 'n' as u16, 'e' as u16, ' ' as u16, 'I' as u16, 'n' as u16,
                'f' as u16, 'o' as u16, 'r' as u16, 'm' as u16, 'a' as u16, 't' as u16, 'i' as u16, 'o' as u16,
                'n' as u16, '(' as u16, '\\' as u16, '_' as u16, 'T' as u16, 'Z' as u16, '.' as u16, 'T' as u16,
                'H' as u16, 'R' as u16, 'M' as u16, ')' as u16, '\\' as u16, 'T' as u16, 'e' as u16, 'm' as u16,
                'p' as u16, 'e' as u16, 'r' as u16, 'a' as u16, 't' as u16, 'u' as u16, 'r' as u16, 'e' as u16,
                0,
            ];

            let mut counter = 0usize;
            if add_counter(query, path.as_ptr(), 0, &mut counter) != 0 {
                close_query(query);
                return Mutex::new(None);
            }

            collect(query);

            Mutex::new(Some(PdhProcs {
                collect,
                get_val,
                query,
                counter,
            }))
        }
    });

    pub fn sample_cpu_temp() -> Option<f32> {
        let lock = PDH_STATE.lock().unwrap();
        if let Some(ref pdh) = *lock {
            unsafe {
                (pdh.collect)(pdh.query);
                let mut counter_type = 0u32;
                let mut val = PdhFmtCountervalueDouble { _c_status: 0, _padding: 0, double_value: 0.0 };
                const PDH_FMT_DOUBLE: u32 = 0x00000200;
                if (pdh.get_val)(pdh.counter, PDH_FMT_DOUBLE, &mut counter_type, &mut val) == 0 {
                    if val.double_value > 200.0 && val.double_value < 400.0 {
                        let c = (val.double_value - 273.15) as f32;
                        return Some((c * 10.0).round() / 10.0);
                    }
                }
            }
        }
        None
    }
}

pub fn get_pc_stats() -> PcStats {
    #[cfg(windows)]
    {
        let cpu_percent = imp::sample_cpu();
        let (ram_used_gb, ram_total_gb, ram_percent) = imp::sample_ram();
        let uptime_secs = imp::sample_uptime();
        let (gpu_percent, gpu_temp, gpu_name) = imp::sample_gpu();
        let cpu_temp = imp::sample_cpu_temp();
        let (battery_percent, is_charging) = super::server::get_system_battery();

        PcStats {
            cpu_percent,
            cpu_temp,
            gpu_percent,
            gpu_temp,
            gpu_name,
            ram_used_gb,
            ram_total_gb,
            ram_percent,
            battery_percent,
            is_charging,
            uptime_secs,
        }
    }
    #[cfg(not(windows))]
    {
        PcStats::default()
    }
}
