$(function () {
    $(window).on("hashchange", function (e) {
        // select admin-header-select
        var keys = $(".admin-header-select-item").map((k, v) => $(v).data("select"))
        var key = location.hash.replace("#", "")
        if ($.inArray(key, keys) != -1) {
            $(".admin-header-select-item").hide()
            $(".admin-header-select-link").removeClass("selected")

            $(`.admin-header-select-item[data-select='${key}']`).show()
            $(`.admin-header-select-link[data-select='${key}']`).addClass("selected")
        }
    })

    $(document).on("click", ".admin-header-select-link", function () {
        var key = location.hash.replace("#", "")
        var new_key = $(this).data("select")
        if (new_key != key) {
            location.hash = new_key
        }
    })

    if (!location.hash) {
        // default: manage feed
        location.hash = "#feed"
    } else {
        // always trigger to update
        $(window).trigger("hashchange")
    }

    // create users
    $(".create-user").click(function () {
        popUp = createPopUp(
            "Create User",
            [
                [
                    {
                        type: "input",
                        name: "handle",
                        placeholder: "twitter handle",
                    },
                ],
                [
                    {
                        type: "input",
                        name: "name",
                        placeholder: "display name",
                    }
                ],
                [
                    {
                        type: "html",
                        content: '<div class="flex row profile-photo-upload"><img class="profile-photo" /><div class="file-upload dashed" data-preview="profile-photo"><input type="file" name="photo" id="photo"><label for="photo"><b>Choose a profile picture</b><span class="file-upload__dragndrop"> or drag it here</span>.</label><div class="file-upload__info"></div><div class="file-upload__error"><span></span></div></div></div>',
                    }
                ]
            ],
            "table",
            [{ classes: ["primary"], link: "javascript:createUser();", title: "Create" }]
        )

        if (testAdvancedUpload()) setAdvancedUpload()
    })

    // delete user
    $(document).on("click", ".user .user-delete", function () {
        var id = $(this).closest(".user").data("id")
        if (id && confirm("Do you really want to delete this user? This action is irreversible and will also permanently delete all tweets associated with the user")) {
            $.get(
                `/api/users/${id}/delete`,
            ).fail(err => {
                alert(err.responseJSON.message)
            }).always(refreshUsers)
        }
    })

    // delete tweet
    $(document).on("click", ".tweet .tweet-delete", function () {
        var id = $(this).closest(".tweet").data("id")
        if (id && confirm("Do you really want to delete this tweet?")) {
            $.get(
                `/api/tweets/${id}/delete`,
            ).fail(err => {
                alert(err.responseJSON.message)
            }).always(refreshFeed)
        }
    })

    // highlight tweet
    $(document).on("click", ".tweet .tweet-highlight", function () {
        var id = $(this).closest(".tweet").data("id")
        $.get(
            `/api/tweets/${id}/highlight`,
        ).fail(err => {
            alert(err.responseJSON.message)
        }).always(refreshFeed)
    })
})

$(function () {
    // settings button actions
    $(".export-room").click(function () {
        $.getJSON(`/api/rooms/${room}/export`).done(data => { downloadObjectAsJson(data, room) })
    })

    $(".delete-room").click(function () {
        if (confirm("Do you really want to delete this room? This action is irreversible.")) {
            $.get(`/api/rooms/${room}/delete`)
                .done(() => { location.href = "/" })
        }
    })

    $(".save-settings").click(function () {
        $("form").addClass("loading")

        $.post(
            `/api/rooms/${room}/settings`, $("form").serialize()
        ).always(() => {
            $("form").removeClass("loading")
        }).fail(err => {
            alert(err.responseJSON.message)
        })
    })
})

function createUser() {
    // validate form
    var files = popUp.container.find("input[type=file]").get(0).files

    if (!($("input[name=handle]").val() && $("input[name=name]").val() && validateFiles(files))) {
        alert("Please fill out both handle and name, and select a valid profile image")
    } else {
        popUp.container.addClass("loading")

        var data = new FormData()
        data.append("file", files[0])
        data.append("room", room)
        data.append("handle", $("input[name=handle]").val())
        data.append("name", $("input[name=name]").val())

        $.ajax({
            url: "/api/users/create",
            method: "post",
            data: data,
            contentType: false,
            processData: false,
        }).fail(function (data) {
            alert(data.responseJSON.message);
        }).always(() => {
            popUp.destroy()
            refreshUsers()
        })
    }
}

function downloadObjectAsJson(exportObj, exportName) {
    var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, 4));
    var downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", exportName + ".json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}