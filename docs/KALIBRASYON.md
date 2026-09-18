# Katsayı Kalibrasyonu (kendi ilan verimizden)

Durum: **kestirim** · eşik: model başına ≥20 ilan, R² ≥ 0.35 · kestirim yapılan model: 18 · kalite filtresine takılan: 2

Toplulaştırılmış katsayılar (18 model, 813 ilan örneklemi):

- km (10.000 km başına, medyan üstü): **-1.20%**
- km (10.000 km başına, medyan altı): **+1.20%** (veri asimetri göstermediği için simetrik)
- yıl (yıllık değer değişimi): **+5.07%**
- medyan R²: 0.8365

## Model bazında

| Marka | Model | n | km/10k | yıl | dizel primi | R² | durum |
|---|---|---|---|---|---|---|---|
| Renault | Clio | 109 | -1.33% | +5.36% | — | 0.886 | ✅ kestirim |
| Renault | Megane | 84 | -0.55% | +6.34% | — | 0.908 | ✅ kestirim |
| Fiat | Egea | 82 | -0.84% | +3.94% | — | 0.586 | ✅ kestirim |
| Fiat | Egea Cross | 65 | +0.14% | +5.37% | — | 0.165 | ⚠️ dışlandı: R² düşük (0.165 < 0.35) |
| Toyota | Corolla | 59 | -0.82% | +5.21% | — | 0.887 | ✅ kestirim |
| Honda | Civic | 51 | -1.52% | +5.06% | — | 0.88 | ✅ kestirim |
| Volkswagen | Polo | 49 | -1.07% | +5.07% | — | 0.743 | ✅ kestirim |
| Opel | Astra | 45 | -0.88% | +4.99% | — | 0.77 | ✅ kestirim |
| Ford | Focus | 44 | -1.56% | +5.13% | — | 0.861 | ✅ kestirim |
| Hyundai | i20 | 38 | -0.65% | +3.96% | — | 0.659 | ✅ kestirim |
| Volkswagen | Golf | 37 | +0.92% | +8.70% | — | 0.829 | ⚠️ dışlandı: km etkisi beklenmedik (pozitif) — muhtemelen yıl/donanım karışması |
| Fiat | Linea | 36 | -2.01% | +1.02% | — | 0.612 | ✅ kestirim |
| Dacia | Duster | 35 | -1.21% | +2.74% | — | 0.736 | ✅ kestirim |
| Volkswagen | Passat | 34 | -1.42% | +7.43% | — | 0.932 | ✅ kestirim |
| Renault | Symbol | 28 | -2.05% | +4.63% | — | 0.761 | ✅ kestirim |
| Volkswagen | Jetta | 28 | -2.05% | +4.64% | — | 0.696 | ✅ kestirim |
| Opel | Corsa | 28 | -1.06% | +5.03% | — | 0.944 | ✅ kestirim |
| Ford | Fiesta | 22 | -0.72% | +7.65% | — | 0.897 | ✅ kestirim |
| Hyundai | Accent | 21 | -1.43% | +6.13% | — | 0.922 | ✅ kestirim |
| Nissan | Qashqai | 20 | -1.19% | +6.80% | — | 0.812 | ✅ kestirim |
| Renault | Fluence | 19 | — | — | — | — | örneklem yetersiz (n=19 < 20) |
| Tofaş | Şahin | 18 | — | — | — | — | örneklem yetersiz (n=18 < 20) |
| Seat | Leon | 18 | — | — | — | — | örneklem yetersiz (n=18 < 20) |
| Mercedes | - | 18 | — | — | — | — | örneklem yetersiz (n=18 < 20) |
| Audi | A3 | 17 | — | — | — | — | örneklem yetersiz (n=17 < 20) |
| Fiat | Punto | 16 | — | — | — | — | örneklem yetersiz (n=16 < 20) |
| Chevrolet | Captiva | 16 | — | — | — | — | örneklem yetersiz (n=16 < 20) |
| Dacia | Sandero | 15 | — | — | — | — | örneklem yetersiz (n=15 < 20) |
| Kia | Sportage | 15 | — | — | — | — | örneklem yetersiz (n=15 < 20) |
| Fiat | Palio | 14 | — | — | — | — | örneklem yetersiz (n=14 < 20) |
| Citroen | C3 | 13 | — | — | — | — | örneklem yetersiz (n=13 < 20) |
| Seat | Ibiza | 13 | — | — | — | — | örneklem yetersiz (n=13 < 20) |
| Peugeot | 2008 | 13 | — | — | — | — | örneklem yetersiz (n=13 < 20) |
| Toyota | Auris | 12 | — | — | — | — | örneklem yetersiz (n=12 < 20) |
| Mitsubishi | L 200 | 12 | — | — | — | — | örneklem yetersiz (n=12 < 20) |
| Opel | Insignia | 11 | — | — | — | — | örneklem yetersiz (n=11 < 20) |
| Tofaş | Doğan | 11 | — | — | — | — | örneklem yetersiz (n=11 < 20) |
| Hyundai | Accent Era | 10 | — | — | — | — | örneklem yetersiz (n=10 < 20) |
| BMW | 3 Serisi | 10 | — | — | — | — | örneklem yetersiz (n=10 < 20) |
| Skoda | Octavia | 10 | — | — | — | — | örneklem yetersiz (n=10 < 20) |
| Toyota | Yaris | 10 | — | — | — | — | örneklem yetersiz (n=10 < 20) |
| BMW | 3 | 10 | — | — | — | — | örneklem yetersiz (n=10 < 20) |
| BMW | 5 Serisi | 9 | — | — | — | — | örneklem yetersiz (n=9 < 20) |
| Peugeot | 3008 | 9 | — | — | — | — | örneklem yetersiz (n=9 < 20) |
| Peugeot | 206 | 9 | — | — | — | — | örneklem yetersiz (n=9 < 20) |
| Peugeot | 301 | 9 | — | — | — | — | örneklem yetersiz (n=9 < 20) |
| Ford | Mondeo | 8 | — | — | — | — | örneklem yetersiz (n=8 < 20) |
| Nissan | Juke | 8 | — | — | — | — | örneklem yetersiz (n=8 < 20) |
| Citroen | C-Elysée | 8 | — | — | — | — | örneklem yetersiz (n=8 < 20) |
| Hyundai | Getz | 7 | — | — | — | — | örneklem yetersiz (n=7 < 20) |
| Mercedes-Benz | C Serisi | 7 | — | — | — | — | örneklem yetersiz (n=7 < 20) |
| Renault | R 9 | 7 | — | — | — | — | örneklem yetersiz (n=7 < 20) |
| Nissan | Micra | 7 | — | — | — | — | örneklem yetersiz (n=7 < 20) |
| Hyundai | Accent Blue | 7 | — | — | — | — | örneklem yetersiz (n=7 < 20) |
| Ford | Ranger | 7 | — | — | — | — | örneklem yetersiz (n=7 < 20) |
| Renault | Captur | 7 | — | — | — | — | örneklem yetersiz (n=7 < 20) |
| Opel | Crossland | 7 | — | — | — | — | örneklem yetersiz (n=7 < 20) |
| Volkswagen | Tiguan | 7 | — | — | — | — | örneklem yetersiz (n=7 < 20) |
| Renault | Kadjar | 7 | — | — | — | — | örneklem yetersiz (n=7 < 20) |
| Skoda | Fabia | 7 | — | — | — | — | örneklem yetersiz (n=7 < 20) |
| Audi | A4 | 7 | — | — | — | — | örneklem yetersiz (n=7 < 20) |
| Opel | Vectra | 6 | — | — | — | — | örneklem yetersiz (n=6 < 20) |
| Skoda | Scala | 6 | — | — | — | — | örneklem yetersiz (n=6 < 20) |
| Peugeot | 207 | 6 | — | — | — | — | örneklem yetersiz (n=6 < 20) |
| Volkswagen | Bora | 6 | — | — | — | — | örneklem yetersiz (n=6 < 20) |
| Hyundai | Bayon | 6 | — | — | — | — | örneklem yetersiz (n=6 < 20) |
| Ford | Kuga | 6 | — | — | — | — | örneklem yetersiz (n=6 < 20) |
| Dacia | Sandero Stepway | 6 | — | — | — | — | örneklem yetersiz (n=6 < 20) |
| Hyundai | i10 | 6 | — | — | — | — | örneklem yetersiz (n=6 < 20) |
| Peugeot | 208 | 6 | — | — | — | — | örneklem yetersiz (n=6 < 20) |
| Citroen | C4 | 6 | — | — | — | — | örneklem yetersiz (n=6 < 20) |
| Fiat | Tipo | 5 | — | — | — | — | örneklem yetersiz (n=5 < 20) |
| Dacia | Logan | 5 | — | — | — | — | örneklem yetersiz (n=5 < 20) |
| Mercedes-Benz | E Serisi | 5 | — | — | — | — | örneklem yetersiz (n=5 < 20) |
| Hyundai | i30 | 5 | — | — | — | — | örneklem yetersiz (n=5 < 20) |
| Nissan | Navara | 5 | — | — | — | — | örneklem yetersiz (n=5 < 20) |
| Isuzu | D-Max | 5 | — | — | — | — | örneklem yetersiz (n=5 < 20) |
| Kia | Stonic | 5 | — | — | — | — | örneklem yetersiz (n=5 < 20) |
| Jeep | Grand Cherokee | 5 | — | — | — | — | örneklem yetersiz (n=5 < 20) |
| Citroen | C3 AirCross | 5 | — | — | — | — | örneklem yetersiz (n=5 < 20) |
| Chevrolet | Aveo | 4 | — | — | — | — | örneklem yetersiz (n=4 < 20) |
| Honda | Accord | 4 | — | — | — | — | örneklem yetersiz (n=4 < 20) |
| Seat | Arona | 4 | — | — | — | — | örneklem yetersiz (n=4 < 20) |
| Land Rover | Freelander | 4 | — | — | — | — | örneklem yetersiz (n=4 < 20) |
| Hyundai | Tucson | 4 | — | — | — | — | örneklem yetersiz (n=4 < 20) |
| Volkswagen | Amarok | 4 | — | — | — | — | örneklem yetersiz (n=4 < 20) |
| Ford | EcoSport | 4 | — | — | — | — | örneklem yetersiz (n=4 < 20) |
| Jeep | Compass | 4 | — | — | — | — | örneklem yetersiz (n=4 < 20) |
| Peugeot | 307 | 4 | — | — | — | — | örneklem yetersiz (n=4 < 20) |
| Ford | C-Max | 4 | — | — | — | — | örneklem yetersiz (n=4 < 20) |
| Kia | Rio | 4 | — | — | — | — | örneklem yetersiz (n=4 < 20) |
| Opel | Mokka | 4 | — | — | — | — | örneklem yetersiz (n=4 < 20) |
| Volvo | S60 | 4 | — | — | — | — | örneklem yetersiz (n=4 < 20) |
| Skoda | SuperB | 4 | — | — | — | — | örneklem yetersiz (n=4 < 20) |
| Renault | R 12 | 4 | — | — | — | — | örneklem yetersiz (n=4 < 20) |
| Tofaş | Kartal | 4 | — | — | — | — | örneklem yetersiz (n=4 < 20) |
| Peugeot | 308 | 4 | — | — | — | — | örneklem yetersiz (n=4 < 20) |
| Mercedes-Benz | 190 | 3 | — | — | — | — | örneklem yetersiz (n=3 < 20) |
| Skoda | Yeti | 3 | — | — | — | — | örneklem yetersiz (n=3 < 20) |
| BMW | X5 | 3 | — | — | — | — | örneklem yetersiz (n=3 < 20) |
| Daihatsu | Terios | 3 | — | — | — | — | örneklem yetersiz (n=3 < 20) |
| Nissan | Skystar | 3 | — | — | — | — | örneklem yetersiz (n=3 < 20) |
| Skoda | Kamiq | 3 | — | — | — | — | örneklem yetersiz (n=3 < 20) |
| Hyundai | Galloper | 3 | — | — | — | — | örneklem yetersiz (n=3 < 20) |
| Honda | CR-V | 3 | — | — | — | — | örneklem yetersiz (n=3 < 20) |
| Audi | Q7 | 3 | — | — | — | — | örneklem yetersiz (n=3 < 20) |
| Peugeot | 508 | 3 | — | — | — | — | örneklem yetersiz (n=3 < 20) |
| BMW | 1 Serisi | 3 | — | — | — | — | örneklem yetersiz (n=3 < 20) |
| Fiat | Albea | 3 | — | — | — | — | örneklem yetersiz (n=3 < 20) |
| Fiat | Panda | 3 | — | — | — | — | örneklem yetersiz (n=3 < 20) |
| Renault | R 19 | 3 | — | — | — | — | örneklem yetersiz (n=3 < 20) |
| Renault | Laguna | 3 | — | — | — | — | örneklem yetersiz (n=3 < 20) |
| Fiat | Tempra | 3 | — | — | — | — | örneklem yetersiz (n=3 < 20) |
| Renault | R | 3 | — | — | — | — | örneklem yetersiz (n=3 < 20) |
| Mazda | 626 | 3 | — | — | — | — | örneklem yetersiz (n=3 < 20) |
| Mini | Cooper | 3 | — | — | — | — | örneklem yetersiz (n=3 < 20) |
| Skoda | Rapid | 3 | — | — | — | — | örneklem yetersiz (n=3 < 20) |
| Jeep | Renegade | 3 | — | — | — | — | örneklem yetersiz (n=3 < 20) |
| Kia | Ceed | 3 | — | — | — | — | örneklem yetersiz (n=3 < 20) |
| Renault | Kangoo | 3 | — | — | — | — | örneklem yetersiz (n=3 < 20) |
| Renault | Trafic | 3 | — | — | — | — | örneklem yetersiz (n=3 < 20) |
| Chevrolet | Rezzo | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Renault | Taliant | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Hyundai | i20 Active | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Lada | Vega | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Renault | Talisman | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Alfa Romeo | 159 | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Volvo | S40 | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Opel | Crossland X | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Opel | Grandland X | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Toyota | Hilux | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Toyota | RAV4 | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Mini | Countryman | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Kia | Sorento | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Land Rover | Range Rover Sport | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| MG | HS | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Land Rover | Range Rover Evoque | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Ford | Puma | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Honda | HR-V | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Hyundai | ix35 | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Volkswagen | Touareg | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Fiat | Siena | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Mini | One | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Renault | Scenic | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Nissan | Terrano | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Jeep | Cherokee | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Nissan | X-Trail | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Kia | Picanto | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Citroen | C5 | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Chevrolet | Cruze | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Seat | Toledo | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Honda | City | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Volkswagen | VW | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Audi | A6 | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| BMW | 1 | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Volkswagen | T-Roc | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Opel | Mokka X | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Subaru | XV | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Opel | Antara | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Fiat | 500 X | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Mercedes-Benz | B Serisi | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Mazda | 3 | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Hyundai | Excel | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Fiat | Uno | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Dacia | Lodgy | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Renault | Express | 2 | — | — | — | — | örneklem yetersiz (n=2 < 20) |
| Rover | 414 | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Fiat | 500 Ailesi | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Volkswagen | Sharan | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Nissan | Note | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Citroen | C4 Picasso | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Chrysler | 300 M | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Honda | Jazz | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Kia | Cerato | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Lada | Samara | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Hyundai | Atos | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Opel | Frontera | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Nissan | Qashqai+2 | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| KGM SsangYong | Musso Grand | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Opel | Grandland | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Citroen | e-C3 AirCross | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Lada | Niva | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Mercedes-Benz | ML | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Dodge | Nitro | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Mazda | CX-3 | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| KGM SsangYong | Actyon Sports | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Volvo | XC90 | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Mercedes-Benz | GLK | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Jeep | Wrangler | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Tofaş | Murat | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Mercedes-Benz | A Serisi | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Chevrolet | Lacetti | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Hyundai | Matrix | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Volkswagen | Touran | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Nissan | Primera | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Volkswagen | Vento | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Chevrolet | Kalos | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Mitsubishi | Outlander | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Volkswagen | Beetle | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Citroen | e-C3 | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Lancia | Delta | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Ford | Fusion | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Peugeot | 106 | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Fiat | 500 | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Citroen | Saxo | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Volkswagen | Scirocco | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Peugeot | 407 | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Mitsubishi | Carisma | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Ford | B-Max | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Peugeot | 306 | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Seat | Altea | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Opel | Meriva | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| BMW | 5 | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Toyota | Verso | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Renault | Latitude | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Hyundai | Kona | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Chery | Tiggo | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Peugeot | Rifter | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Kia | Soul | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Citroen | C4 Cactus | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| KGM SsangYong | Rexton | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Hyundai | Santa Fe | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Suzuki | SJ | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Mitsubishi | ASX | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Fiat | Freemont | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Land Rover | Range Rover | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Audi | Q5 | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| BMW | X1 | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Toyota | C-HR | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Citroen | C4 Grand Picasso | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Tofaş | Serçe | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Subaru | Impreza | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Nissan | Maxima | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Daihatsu | Cuore | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| BMW | 4 Serisi | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Citroen | C4 X | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Mini | Cooper S | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Volkswagen | Passat Variant | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Volvo | V40 | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Seat | Cordoba | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Nissan | Sunny | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Mercedes-Benz | SLK | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Fiat | Topolino | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Fiat | Marea | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Chrysler | 300 C | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Renault | Modus | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Volkswagen | Caddy | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Seat | Ateca | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Volvo | XC40 | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Volkswagen | Caravelle | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Skoda | Kodiaq | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Cupra | Formentor | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Ford | Transit 350 | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Fiat | Ducato 15 | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Chery | Omoda | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Toyota | Corolla Cross | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Skoda | Karoq | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Dacia | Jogger | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Renault | Austral | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Renault | Duster | 1 | — | — | — | — | örneklem yetersiz (n=1 < 20) |
| Ford | Tourneo | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Fiat | Doblo | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Citroen | Berlingo | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Honda | ADV 350 | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Ford | - | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Can-Am | Renegade 1000 | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Honda | Forza 250 | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Ticari | Araçlar | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Fiat | Fiorino | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Nissan | Pick | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Yamaha | X-Max 250 | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Alfa Romeo | Giulietta | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Citroen | Nemo | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Opel | Frontera-e | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Smart | Roadster | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Ford | Transit | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Yamaha | MT 25 | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| KGM | SsangYong | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Fiat | Ducato | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Isuzu | NPR | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Ford | Trucks | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Fiat | Uno 70 | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Volkswagen | Crafter | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Kuba | Ege 50 | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Elektrikli | Araçlar | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Yamaha | YZF | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Mitsubishi | L 300 | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Ford | Transit 190 | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Ramzey | 100 | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Fiat | 411 | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Iveco | - | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Mazda | B2500 | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| New | Holland | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Fiat | 70-56 | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Peugeot | 107 | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Ford | Ka | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Karavan | Motokaravan | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Isuzu | KB | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Yamaha | R7 | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Renault | Master | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Subaru | Forester | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Volkswagen | Transporter | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Opel | Combo | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Zontes | 310 | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Fiat | Scudo | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Dacia | Dokker | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Yuki | LX 200 | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Citroen | C5AIRCROSS | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Toyota | AURIS | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Kia | STONIC | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Honda | CIVIC | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Peugeot | RIFTER | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Nissan | QASHQAI | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Renault | CLIO | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Bmw | 320d | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Opel | INSIGNIA | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Renault | KOLEOS | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Chery | TIGGO | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Seat | IBIZA | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Mercedes | C200 | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |
| Peugeot | PARTNER | 0 | — | — | — | — | örneklem yetersiz (n=0 < 20) |

**Kestirilemeyen katsayılar:** tramer şiddeti, boyalı/değişen parça. İlan listelerinde hasar alanı
yok; bu katsayılar `varsayım` olarak kalır ve raporda öyle etiketlenir.
