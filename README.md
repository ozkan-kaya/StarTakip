# StarTakip

Cari, stok ve işlem takip uygulaması — **v1.2.1**.
Firebase Authentication, Cloud Firestore ve Firebase Hosting kullanır.

## Dosyalar

- `Firebase/public/`: çalışan uygulama, iş kuralları, PIN güvenliği ve PDF araçları
- `Firebase/firestore.rules`: kullanıcı erişimi, kişisel PIN alanları ve değiştirilemez firma sürümleri
- `Firebase/firestore.indexes.json`: veritabanı indeksleri
- `database/schema.json`: boş veritabanı şeması; gerçek iş kayıtları içermez

## Kurulum

1. Firebase projesinde Google girişini, Firestore Standard veritabanını ve Hosting'i etkinleştirin.
2. `Firebase/public/config.example.json` dosyasını `config.json` olarak kopyalayıp kendi Firebase web ayarlarınızı girin.
3. `Firebase/.firebaserc.example` dosyasını `.firebaserc` olarak kopyalayıp proje kimliğini girin; `Firebase/firebase.json` içindeki `hosting.site` alanını da kendi site kimliğinizle değiştirin.
4. `adapter.mjs` ve `firestore.rules` içindeki örnek izinli hesapları birlikte düzenleyin; istemci kontrolü ve veritabanı kuralları aynı hesaplara izin vermelidir.
5. Firma başlangıç bilgileri örnek değerlerdir; `company.mjs` ve kurallardaki v1 değerlerini birlikte uyarlayın, kaydedilmiş geçmiş sürümleri değiştirmeyin.
6. Firebase CLI ile kendi hesabınızdan giriş yapın; `Firebase` klasöründen yalnız Hosting, Firestore kuralları ve indeksleri yayınlayın.

## Güvenlik ve ortak veriler

- İzinli hesaplar Google girişi ve Firestore kurallarıyla sınırlandırılır.
- PIN ve işlem güvenliği ayarları `userSecurity/{uid}/settings/` altında kullanıcıya özeldir; kullanıcılar birbirinin PIN ayarını okuyamaz veya değiştiremez.
- Firma sürümleri ve ticari veriler izinli kullanıcılar arasında ortaktır; kesinleşmiş belgeler firma sürümünü saklar.
- Gerçek kayıtlar, kişisel iletişim bilgileri, gerçek API anahtarları, şifreler, özel anahtarlar, oturum dosyaları ve asıl Firebase yapılandırması GitHub'a dahil edilmez; yerel ayarlar `.gitignore` ile dışlanır.
- `.env` kullanmak tarayıcıya gönderilen ayarları gizlemez; veri erişimini Authentication ve sunucu kuralları korur.

## Sürüm kontrolü

`v1.2.1`: profil fotoğrafının yuvarlak alan içinde merkezlenmesi; iki izinli hesap, kullanıcıya özel PIN/işlem güvenliği ve ortak sürümlü firma bilgileriyle Firebase yayın sürümü.
Kaynak kodunu GitHub'a push etmek tek başına Firebase'e yayın yapmaz.

Üçüncü taraf PDF kütüphanelerinin lisansları `vendor/` içinde korunur.
