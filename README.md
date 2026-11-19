# StarTakip

Firebase Authentication, Cloud Firestore ve Firebase Hosting kullanan cari, stok ve işlem takip uygulamasının kişisel bilgilerden arındırılmış kaynak kodu.

## İçerik

- `Firebase/public/`: arayüz, iş kuralları, kayıt katmanı, PIN güvenliği ve PDF araçları
- `Firebase/firestore.rules`: erişim ve veri yazma kuralları
- `Firebase/firestore.indexes.json`: Firestore indeks tanımları
- `database/schema.json`: boş veritabanı şeması; gerçek kayıt içermez

## Yerel yapılandırma

1. Firebase projesinde Google girişini, Firestore Standard veritabanını ve Hosting'i etkinleştirin.
2. `Firebase/public/config.example.json` dosyasını `config.json` adıyla kopyalayıp kendi Firebase web yapılandırmanızı girin; bu yerel dosya Git tarafından dışlanır.
3. `Firebase/.firebaserc.example` dosyasını `.firebaserc` olarak kopyalayıp proje kimliğinizi girin.
4. `Firebase/public/adapter.mjs` ve `Firebase/firestore.rules` içindeki `authorized-user@example.invalid` adresini kendi izinli hesabınızla değiştirin; istemci ve sunucu kuralları aynı kullanıcıya izin vermelidir.
5. Firma başlangıç değerleri örnektir; `company.mjs` ve kurallardaki v1 değerleri birlikte uyarlanmalıdır, kaydedilmiş eski sürümler değiştirilmemelidir.
6. Kendi Firebase CLI hesabınızla giriş yapıp `Firebase` klasöründen yerel yapılandırmanızla çalışın; kaynak kodunu GitHub'a göndermek Firebase'e otomatik yayın yapmaz.

## Veri ve güvenlik

Gerçek Firestore kayıtları, kullanıcı bilgileri, PIN doğrulayıcıları, şifreler, özel anahtarlar, oturum dosyaları, API anahtarları ve asıl proje yapılandırması bu depoya dahil edilmemiştir.
Bu kaynak anlık görüntüsünde tek hesap için erişim kontrolü ve ortak PIN yapılandırması bulunur; iki kullanıcıya ayrı PIN desteği henüz uygulanmış değildir.
`.env` veya Git dışlama, tarayıcıya gönderilen ayarları gizli hale getirmez; veri erişimi Authentication ve Firestore kurallarıyla korunur.

`vendor/` içindeki üçüncü taraf kütüphanelerin lisansları ilgili dosyalarla birlikte korunmuştur.
