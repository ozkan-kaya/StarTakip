# StarTakip

Cari, stok ve işlem takip uygulaması — **v1.3.16**.
Firebase Authentication, Cloud Firestore ve Firebase Hosting kullanır.

## Dosyalar

- `Firebase/public/`: çalışan uygulama, iş kuralları, PIN güvenliği ve PDF araçları
- `Firebase/firestore.rules`: kullanıcı erişimi, kişisel PIN alanları ve değiştirilemez firma sürümleri
- `Firebase/firestore.indexes.json`: veritabanı indeksleri
- `database/schema.json`: boş veritabanı şeması; gerçek iş kayıtları içermez

## Kurulum

1. Firebase projesinde Google girişini, Firestore Standard veritabanını ve Hosting'i etkinleştirin.
2. `Firebase/public/config.example.json` dosyasını `config.json` olarak kopyalayıp kendi Firebase web ayarlarınızı girin. Firebase Console’dan SDK ayarlarını yeniden alırsanız, gerçek `Firebase/public/config.json` dosyasında `authDomain` değerini `startakip9.web.app` olarak koruyun.
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

`v1.3.16` gezinme çubuğunun geçişini yumuşatır ve CSV indirme düğmeleriyle ilgili kodu kaldırır.

`v1.3.15` Yeni İşlem başlığını, tarih ve saat satırını ve cari ile ürün seçicilerinin köşelerini günceller.

`v1.3.14` işlem saatini kayıt zamanından ayrı saklar ve ilgili liste ve fişlerde gösterir.

`v1.3.13` fişlerde firmayı sol tarafta tutar ve taraf etiketlerini işlem türüne göre gösterir.

`v1.3.12` PIN ayarlarını açmadan önce hazırlar ve eski kapanış olaylarının açık ekranı temizlemesini önler.

`v1.3.11` dış tıklamayı PIN ve Ayarlar diyaloglarının kendi kapanış kurallarına bırakır.

`v1.3.10`: alış ve satış dökümlerinde Teklif Fişi, diğer işlemlerde İşlem Fişi başlığı kullanılır.

`v1.3.9`: döküm, PDF ve yazdırmada fiş başlığı Teklif Fişi olarak gösterilir.

`v1.3.8`: iPhone PWA’da Google girişi yönlendirme üzerinden tamamlanır.

`v1.3.7`: yükleme göstergeleri tablo, modal ve giriş düğmesinin kendi alanında gösterilir.

`v1.3.6`: uygulama `startakip9` Firebase projesine taşındı.

`v1.3.5`: Google girişi yanıt vermezse 30 saniye sonra yeniden denenebilir.

`v1.3.4`: iPhone ve Android için ana ekrandan kurulabilen, çevrimiçi PWA desteği.

`v1.3.3`: üst menüde seçili bölümün ve ana sayfada Star Takip logosunun kenarlığı görünür kalır.

`v1.3.2`: Google giriş düğmesi, stok modalı işlemlerinin dizilimi ve kart geçişleri.

`v1.3.1`: daha hızlı menü yüklemesi, kayıt sonrası tutarlı tablo yenileme ve güncellenen stok işlemleri.

`v1.3.0`: belge sürümü seçimi, güncellenen fiş ve PDF düzeni, kompakt onay pencereleri.

`v1.2.1`: profil fotoğrafının yuvarlak alan içinde merkezlenmesi; iki izinli hesap, kullanıcıya özel PIN/işlem güvenliği ve ortak sürümlü firma bilgileriyle Firebase yayın sürümü.
Kaynak kodunu GitHub'a push etmek tek başına Firebase'e yayın yapmaz.

Üçüncü taraf PDF kütüphanelerinin lisansları `vendor/` içinde korunur.
