use std::sync::Mutex;
use qrcode::QrCode;
use qrcode::render::svg;
use ring::rand::{SecureRandom, SystemRandom};

static TOKEN: Mutex<Option<String>> = Mutex::new(None);

pub fn get_or_create_token() -> String {
    let mut lock = TOKEN.lock().unwrap();
    if let Some(ref t) = *lock {
        return t.clone();
    }
    let new_tok = generate_random_token();
    *lock = Some(new_tok.clone());
    new_tok
}

pub fn verify_token(provided: &str) -> bool {
    let provided = provided.trim();
    if provided.is_empty() {
        return false;
    }
    let token = get_or_create_token();
    provided == token.trim()
}

pub fn generate_qr_svg_for_url(url: &str) -> String {
    match QrCode::new(url.as_bytes()) {
        Ok(code) => code.render::<svg::Color>().min_dimensions(200, 200).build(),
        Err(_) => String::new(),
    }
}

pub fn generate_qr_svg() -> String {
    let token = get_or_create_token();
    let url = format!("http://coucou.local:47822?token={token}");
    generate_qr_svg_for_url(&url)
}

fn generate_random_token() -> String {
    let mut bytes = [0u8; 8];
    if SystemRandom::new().fill(&mut bytes).is_ok() {
        bytes.iter().map(|b| format!("{b:02x}")).collect()
    } else {
        let t = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        format!("{:016x}", t)
    }
}
