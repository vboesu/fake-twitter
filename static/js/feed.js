var feedRefreshTimeout = null
var lastFeedDataHash = null

function refreshFeed() {
    var url = typeof user !== "undefined" ? `/api/users/${user}/feed` : `/api/rooms/${room}/feed`
    url += typeof feedArgs !== "undefined" ? args(feedArgs) : ""

    clearTimeout(feedRefreshTimeout)

    $.getJSON(url)
        .done(data => {
            // only update if changed
            hash = base64(JSON.stringify(data))
            if (hash != lastFeedDataHash) {
                fillPrototype(data, ".tweet", ".tweets")
            }
            lastFeedDataHash = hash
            feedRefreshTimeout = setTimeout(refreshFeed, 5000)

            // tweet styles
            $(".tweet .tweet-text").each(function (k, v) {
                $(this).html($(this).text().replace(/([@|#][\S]+)/gm, '<span class="tweet-interactive">$1</span>'))
            })
        })
        .fail(error => {
            console.error(error)
        })
}

$(function () {
    // check for new tweets every second
    refreshFeed()
})