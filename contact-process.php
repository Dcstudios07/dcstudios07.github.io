<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $name    = strip_tags(trim($_POST["name"]));
    $email   = filter_var(trim($_POST["email"]), FILTER_SANITIZE_EMAIL);
    $subject = strip_tags(trim($_POST["subject"]));
    $message = strip_tags(trim($_POST["message"]));

    // Aapka email jahan message receive hoga
    $to = "amit.soni5157@gmail.com";

    // Email content
    $email_content = "Name: $name\n";
    $email_content .= "Email: $email\n";
    $email_content .= "Subject: $subject\n";
    $email_content .= "Message:\n$message\n";

    // Email headers
    $headers = "From: $name <$email>";

    // Send email
    if (mail($to, $subject, $email_content, $headers)) {
        echo "<p style='text-align:center; color:green;'>Thank you! Your message has been sent.</p>";
    } else {
        echo "<p style='text-align:center; color:red;'>Oops! Something went wrong, please try again.</p>";
    }
} else {
    // Agar form direct visit hua
    echo "<p style='text-align:center; color:red;'>Invalid request</p>";
}
?>
