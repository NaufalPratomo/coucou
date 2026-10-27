// Windows Geolocation provider via WinRT Windows.Devices.Geolocation

#[tauri::command]
pub async fn get_device_coordinates() -> Option<[f64; 2]> {
    #[cfg(windows)]
    {
        tokio::time::timeout(
            std::time::Duration::from_millis(3000),
            tokio::task::spawn_blocking(|| {
                use windows::Devices::Geolocation::Geolocator;
                let geolocator = Geolocator::new().ok()?;
                let op = geolocator.GetGeopositionAsync().ok()?;
                let pos = op.get().ok()?;
                let coord = pos.Coordinate().ok()?;
                let point = coord.Point().ok()?;
                let position = point.Position().ok()?;
                Some([position.Latitude, position.Longitude])
            }),
        )
        .await
        .ok()?
        .ok()?
    }
    #[cfg(not(windows))]
    {
        None
    }
}
