# VanitySign Transfers

> **Plataforma de reservas de transfers de luxo para a Península Ibérica** — Portugal & Espanha.

O VanitySign Transfers é uma plataforma web que desenvolvi para gerir reservas de transfers privados premium. Construí tudo com JavaScript puro, Firebase e Leaflet maps, e o sistema está dividido em três áreas: **Clientes**, **Motoristas** e **Administradores**.

---

## 📖 Sobre o Projecto

Criei este projecto no âmbito da minha PAP (Prova de Aptidão Profissional) do curso de Programação. O objectivo era construir uma plataforma funcional de reserva de transfers de luxo do zero — com autenticação, mapas interactivos, gestão de frota e atribuição de motoristas — sem usar frameworks, só HTML, CSS e JavaScript puro.

O sistema cobre o ciclo completo de uma reserva: o cliente regista-se, escolhe o veículo, vê a rota no mapa, faz a reserva; o admin atribui o motorista e o carro; o motorista actualiza o estado da viagem; e no final o cliente pode avaliar.

---

## ✨ Funcionalidades

### 🙋 Cliente

- **Login com Google** — autenticação rápida com aceitação dos Termos de Serviço
- **Reserva** — escolho a morada de recolha e destino, selecciono entre 4 tipos de veículo (Comfort Sedan, Business Sedan, MPV, Van), defino passageiros, bagagem, número de voo e observações
- **Rota interactiva** — mapa Leaflet com o percurso real (OSRM), distância e tempo estimado
- **Painel do cliente** — reservas activas, viagens por avaliar e histórico
- **Cancelamento** — cancelo reservas pendentes ou atribuídas
- **Avaliações** — classificação de 1 a 5 estrelas nas viagens concluídas
- **3 idiomas** — Inglês, Português e Espanhol (mais de 174 chaves, troca ao vivo sem recarregar)
- **Modo escuro/claro** — porque cada um tem as suas preferências
- **Responsivo** — funciona bem em desktop, tablet e telemóvel

### 🚗 Motorista

- **Lista de transfers atribuídos** com o fluxo de estados passo a passo
- **Tooltip a guiar o processo** para o motorista não se perder
- **Actualizações de estado** — Iniciar Viagem → Cliente a Bordo / No-Show → Concluir
- **Calendário** com as transfers agendadas
- **Histórico de viagens**

### 🛠️ Administrador

- **Painel de atribuições pendentes** — atribuo motoristas e carros às reservas
- **Detecção de conflitos** — o sistema impede double-booking de motoristas e veículos
- **Validação hierárquica** — veículos superiores podem fazer reservas inferiores (com confirmação); veículos inferiores são bloqueados
- **Validação de capacidade** — verifica passageiros e bagagem antes de atribuir
- **Gestão de utilizadores** — mudo funções entre cliente, motorista e admin
- **Gestão de avaliações** — removo avaliações inadequadas
- **Gestão de frota** — adiciono, edito observações, desactivo ou elimino veículos
- **Calendário geral** — visão completa de todas as transfers com detalhes por dia

---

## 🔄 Fluxo de Estados

```
pendente → atribuída → à_espera_do_cliente → em_destino → concluída
    ↓                                     ↓
cancelada                              no-show
```

O cliente pode cancelar nos estados `pendente` ou `atribuída`.

---

## 🚙 Tipos de Veículo

| Tipo | Máx. Pax | Máx. Bagagem | Preço/km |
|------|:--------:|:------------:|:--------:|
| Comfort Sedan | 4 | 4 pts | €0.80 |
| Business Sedan | 4 | 4 pts | €1.00 |
| MPV | 5 | 5 pts | €1.10 |
| Van | 8 | 8 pts | €1.45 |

**Bagagem:** mala de mão = 1 pt, mala de porão = 2 pts, adicional = 1 pt cada.

**Regra de upgrade:** veículos de categoria superior podem servir reservas inferiores (com confirmação). Veículos inferiores **não** podem servir reservas superiores.

---

## 🛠️ Tecnologias que usei

| Componente | Tecnologia |
|---|---|
| **Frontend** | HTML5, CSS3, JavaScript puro |
| **Mapas** | Leaflet.js + OSRM (rotas reais, tempo de viagem) |
| **Geocodificação** | Nominatim (OpenStreetMap) com cache |
| **Backend** | Firebase Firestore (base de dados NoSQL) |
| **Autenticação** | Firebase Auth (Google Sign-In) |
| **Traduções** | Sistema i18n próprio com JSON (EN, PT, ES) |
| **SEO** | Meta tags Open Graph + Twitter Card |
| **Alojamento** | Estático (Firebase Hosting, Vercel, Netlify…) |

---

## 📂 Estrutura do Projecto

```
VanitySign/
├── index.html              # Página inicial com login
├── booking.html            # Formulário de reserva
├── dashboard.html          # Painel do cliente
├── driver.html             # Painel do motorista
├── admin.html              # Painel do admin
├── cars.html               # Gestão de frota (admin)
├── terms.html              # Termos de Serviço
├── 404.html                # Página de erro
├── style.css               # Estilos todos (responsivo, temas)
├── config.js               # Credenciais Firebase (não está no git!)
├── config.example.js       # Template das credenciais
├── js/
│   ├── core.js             # Firebase init, auth, funções partilhadas
│   ├── index.js            # Lógica da página inicial
│   ├── booking.js          # Reserva e mapas
│   ├── dashboard.js        # Painel do cliente
│   ├── driver.js           # Painel do motorista
│   ├── admin.js            # Painel do admin
│   └── shared-ui.js        # Header, definições, i18n, tema
├── locales/
│   ├── en.json
│   ├── pt.json
│   └── es.json
└── assets/
    ├── VanitySignLogo.png
    ├── VanitySignLogoText.jpg
    ├── VanitySignNoBG.png
    └── *.jpg               # Fotos dos destinos
```

---

## 📄 Licença

Projecto privado — todos os direitos reservados.

---

## 👤 Desenvolvido por

**Walter Parra** — PAP | Curso Profissional de Programação
