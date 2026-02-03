# WhatsApp Msgstore Web Viewer

A modern, high-performance web viewer for WhatsApp `msgstore.db` (and `msgstore.db.crypt15`) files.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Open%20App-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://trevordixon.github.io/whatsapp-msgstore-web-viewer/)

[Download the sample msgstore.db](https://github.com/trevordixon/whatsapp-msgstore-web-viewer/raw/refs/heads/main/msgstore.db) from this repository to test.

## Privacy First

**Your data never leaves your computer.** 

This application runs entirely in your browser. The database file is processed locally using WebAssembly (SQL.js). No data is uploaded to any server, ensuring your conversations remain private.

## Features

*   **Modern UI:** A clean interface inspired by WhatsApp Web.
*   **Fast & Local:** instant loading and querying of SQLite databases directly in the browser.
*   **Search:** Filter conversations by contact name or phone number.
*   **Date Grouping:** Messages are intuitively grouped by "Today", "Yesterday", and specific dates.
*   **Responsive:** Works on desktop and mobile.

## How to Use

1.  **Obtain your database:** You need a `msgstore.db` file (encrypted or unencrypted).
    *   *Note: Standard backups found in Android/WhatsApp/Databases are usually encrypted (e.g., `msgstore.db.crypt14`).*
2.  **Open the App:** Go to the [Live Demo](https://trevordixon.github.io/whatsapp-msgstore-web-viewer/).
3.  **Upload:** Click the upload box and select your `.db` file.
4.  **Browse:** Select a chat from the sidebar to view history.

## Encrypted Databases (New!)

We now support opening encrypted WhatsApp databases directly.

*   **Supported Formats:** `.crypt15` (Verified), `.crypt14`, `.crypt12`
*   **Requirements:**
    1.  The encrypted file (e.g., `msgstore.db.crypt15`)
    2.  The decryption key (e.g., `encrypted_backup.key`) **OR** your 64-character hex recovery key.
*   **Where to find the key:** 
    *   **Rooted Android:** `/data/data/com.whatsapp/files/key`
    *   **E2E-Encrypted Backups:** Use your 64-digit hex key.
*   **How to use:** Upload your `.crypt15` file, and when prompted, simply drag & drop your key file or paste the hex string.

> **Note:** Decryption is typically verified on `crypt15` files. Older formats may work but are heuristic-based.


## Screenshots

<p align="center">
  <img src="https://github.com/user-attachments/assets/a2f878a2-e34d-47da-8a34-54f9b48b073a" alt="Landing Page" width="45%">
  &nbsp; &nbsp;
  <img src="https://github.com/user-attachments/assets/685b372c-985e-4e68-8063-3cd5d465dd2b" alt="Chat View" width="45%">
</p>

## Running Locally

Pull requests are welcome! If you want to contribute or run this on your own machine:

1.  **Clone the repository**
    ```bash
    git clone https://github.com/trevordixon/whatsapp-msgstore-web-viewer.git
    cd whatsapp-msgstore-web-viewer
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Start the dev server**
    ```bash
    npm run dev
    ```

4.  **Build for production**
    ```bash
    npm run build
    ```

## Running with Docker

You can also run this application using Docker (e.g., on a NAS or server).

1.  **Build and Run**
    ```bash
    docker compose up -d --build
    ```

2.  **Access the App**
    Open `http://localhost:8080` in your browser.

### Manual Build

If you prefer to build the image manually without Docker Compose:

1.  **Build the image**
    ```bash
    docker build -t whatsapp-msgstore-web-viewer .
    ```

2.  **Run the container**
    ```bash
    docker run -d -p 8080:80 --name whatsapp-msgstore-web-viewer whatsapp-msgstore-web-viewer
    ```

### Using Pre-built Image

You can also pull the pre-built image from the GitHub Container Registry:

    docker run -d -p 8080:80 ghcr.io/siddharthsbhadauria/whatsapp-msgstore-web-viewer:main

## License

Open source. Feel free to fork and improve!
