# Caça-Leads: coleta de dados via API do Google Maps

Ferramenta web que busca empresas no Google Maps por **tipo de negócio** e **cidade/bairro** e separa as que **não têm site próprio** (ou só têm Instagram, Facebook ou Linktree). Serve para encontrar potenciais clientes para serviços de criação de sites.

## O que ela faz

- **Coleta de dados via API REST:** consulta a Google Places API (New), com paginação de até 60 resultados por busca
- **Filtragem e classificação:** separa quem não tem site, quem só tem rede social e ordena pelo número de avaliações (negócio ativo e sem site = lead mais quente)
- **Gestão de leads:** salva os melhores leads com status (novo → contatado → fechado) e anotações
- **Modo demonstração:** dá para testar sem chave da API

## Tecnologias

- **Node.js** (servidor HTTP sem frameworks)
- **JavaScript, HTML e CSS** (interface)
- **Google Places API (New)**
- Armazenamento local em **JSON**

## Como rodar

1. Instale o [Node.js](https://nodejs.org) 18 ou superior.
2. Rode `node server.js` (ou dê dois cliques em `iniciar.bat` no Windows) e abra http://localhost:3333
3. Coloque sua chave da Google Places API na tela de **Configurações**, ou copie `.env.example` para `.env` e coloque a chave lá. O `.env` fica fora do Git pelo `.gitignore`.

## Dicas de uso

- O Google devolve no máximo 60 resultados por busca. Para achar mais, divida a cidade em bairros.
- Defina um limite diário de cota no Google Cloud Console para controlar o custo.

> Desenvolvido com apoio de IA (Claude) como ferramenta de produtividade.
