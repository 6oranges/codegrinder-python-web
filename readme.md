To properly host make sure to
```
location / {
    # set response headers
    add_header 'Cross-Origin-Embedder-Policy' 'require-corp';
    add_header 'Cross-Origin-Opener-Policy' 'same-origin';
}
```